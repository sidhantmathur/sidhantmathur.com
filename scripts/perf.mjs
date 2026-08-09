// Throttled first-load measurement, so "it feels fine on my laptop" stops being
// the standard this site is held to.
//
// The restaurant-wifi incident is the reason this exists. On a slow connection
// the page paints long before it hydrates, and for those seconds it LOOKS like
// a finished interface — a composer, a send button, four question chips — while
// every tap goes nowhere. This measures that window rather than guessing at it.
//
// What it drives: a real Chromium over CDP with CPU and network throttling
// applied BEFORE the first navigation, against `next start` on the production
// build. Numbers off a dev server measure Turbopack, not the site.
//
// Usage:
//   node scripts/perf.mjs                       # / and /resume, mobile profile
//   node scripts/perf.mjs / /resume /colophon
//   node scripts/perf.mjs --desktop
//   node scripts/perf.mjs --json out.json       # machine-readable, for diffing
//   BASE=https://<preview>.vercel.app node scripts/perf.mjs
//
// Requires the site to be built and served already when BASE is set; otherwise
// it starts `next start` itself on port 3100.

import { spawn } from "node:child_process";
import { connect } from "node:net";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const jsonAt = args.indexOf("--json");
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
const routes = args.filter(
  (a) => !a.startsWith("--") && a !== jsonOut,
);
if (routes.length === 0) routes.push("/", "/resume");

const desktop = flags.has("--desktop");
const RUNS = Number(process.env.RUNS ?? 3);
const PORT = Number(process.env.PORT ?? 3100);
const BASE = (process.env.BASE ?? `http://localhost:${PORT}`).replace(/\/$/, "");
const external = Boolean(process.env.BASE);

// The profile. "Slow 4G" as Lighthouse defines it (1.6 Mbps down, 750 Kbps up,
// 150ms RTT) plus a 4× CPU slowdown, which is roughly a mid-tier Android. This
// is the profile the acceptance criteria are stated against; changing it
// invalidates every before/after number in the commit log, so don't, quietly.
const PROFILE = desktop
  ? {
      name: "desktop, fast 3G + 2x CPU",
      viewport: { width: 1280, height: 800 },
      cpu: 2,
      down: (10 * 1024 * 1024) / 8,
      up: (5 * 1024 * 1024) / 8,
      rtt: 40,
    }
  : {
      name: "mobile 390x844, slow 4G + 4x CPU",
      viewport: { width: 390, height: 844 },
      cpu: 4,
      down: (1.6 * 1024 * 1024) / 8,
      up: (750 * 1024) / 8,
      rtt: 150,
    };

/**
 * Injected before any page script. Records the moment the document becomes
 * genuinely interactive, which React does not report and no Web Vital covers.
 *
 * TWO SIGNALS, and the reason there are two is that the measurement has to be
 * valid on both sides of the change it is measuring:
 *
 *   react   React writes `__reactProps$…` / `__reactFiber$…` onto a DOM node
 *           the moment it hydrates it. Server HTML carries no such key, so the
 *           frame this appears on the composer is the frame the composer's
 *           listeners started existing. Works on the unmodified site, which is
 *           what makes the "before" column real.
 *   flag    `<html data-hydrated="true">`, set by the app itself. Once the fix
 *           lands this is the same instant, and it is the signal the app's own
 *           behaviour is keyed to — so a regression that leaves the flag lying
 *           shows up here as the two marks disagreeing.
 *
 * Polled on rAF rather than an interval: during hydration the main thread is
 * blocked, and a rAF callback resolves on the first frame after it clears,
 * which is exactly the moment being asked about.
 */
const PROBE = `
  window.__perf = { marks: {}, lcp: 0, lcpEl: '', longTasks: 0, longTaskMs: 0 };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__perf.lcp = e.startTime;
      // Which element it was. Knowing LCP is 3.9s is half a finding; knowing it
      // is a decorative backdrop image rather than the headline is the half
      // that says what to do about it.
      const el = e.element;
      window.__perf.lcpEl = e.url
        ? e.url.split('/').pop()
        : el
          ? el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')
          : '';
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__perf.longTasks += 1;
        window.__perf.longTaskMs += e.duration;
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  function reactMounted() {
    // The composer if it exists, else anything React owns on a document route.
    const el = document.getElementById('ask') || document.querySelector('[data-slot], main, body > div');
    if (!el) return false;
    for (const k in el) {
      if (k.startsWith('__reactProps$') || k.startsWith('__reactFiber$')) return true;
    }
    return false;
  }
  function tick() {
    const m = window.__perf.marks;
    if (m.react == null && reactMounted()) m.react = performance.now();
    if (m.flag == null && document.documentElement.dataset.hydrated === 'true') {
      m.flag = performance.now();
    }
    // The mark everything downstream reads. Whichever signal the build has.
    if (m.hydrated == null && (m.react != null || m.flag != null)) {
      m.hydrated = m.react ?? m.flag;
    }
    if (m.react != null && m.flag != null) return;
    // A build with only one of the two signals must not leave a rAF loop
    // running for the rest of the measurement — that is main-thread work this
    // script invented, showing up in the numbers it is trying to report.
    if (m.hydrated != null && performance.now() - m.hydrated > 2000) return;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
`;

function median(xs) {
  const s = [...xs].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

const fmt = (n) => (n == null ? "—" : `${Math.round(n)}`);
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

/**
 * Starts `next start` and returns the port it ACTUALLY bound to.
 *
 * The port matters more than it looks. When something is already listening on
 * the requested port — a server left behind by an earlier run of this very
 * script — Next quietly shifts to the next one and says so in a line that is
 * easy not to read. Point the browser at the requested port anyway and you
 * measure the stale server: an old build, or worse, an old build whose chunks
 * were deleted by the rebuild you are trying to measure. That produces a
 * complete set of plausible numbers describing nothing, which is the failure
 * mode this whole script exists to prevent. So the port is parsed back out of
 * Next's own output and everything downstream uses that.
 */
async function startServer(port) {
  const proc = spawn("npx", ["next", "start", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  const bound = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("next start timed out")), 60_000);
    let seen = null;
    const onData = (buf) => {
      const line = String(buf);
      const m = line.match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
      if (m) seen = Number(m[1]);
      if (/Ready|started server/i.test(line)) {
        clearTimeout(timer);
        resolve(seen ?? port);
      }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`next start exited with ${code}`));
    });
  });
  return { proc, port: bound };
}

/** One cold load of one route, with the throttle applied before navigation. */
async function measure(browser, url) {
  const context = await browser.newContext({
    viewport: PROFILE.viewport,
    deviceScaleFactor: desktop ? 1 : 2,
    isMobile: !desktop,
    hasTouch: !desktop,
    colorScheme: "dark",
  });
  await context.addInitScript(PROBE);
  const page = await context.newPage();

  // Bytes over the wire, by type. Taken from `request.sizes()` on
  // `requestfinished` — the encoded transfer size, which is the number that
  // costs the visitor time, not the decompressed one.
  //
  // NOT from a `response` handler awaiting `res.body()`: reading a body inside
  // that event holds the response open, and on a throttled connection that
  // deadlocks the very load being measured. It cost an hour to find once.
  const bytes = { js: 0, css: 0, image: 0, font: 0, doc: 0, other: 0 };
  const files = [];
  page.on("requestfinished", async (req) => {
    try {
      const type = req.resourceType();
      const { responseBodySize = 0, responseHeadersSize = 0 } = await req.sizes();
      const size = responseBodySize + responseHeadersSize;
      const key =
        type === "script"
          ? "js"
          : type === "stylesheet"
            ? "css"
            : type === "image"
              ? "image"
              : type === "font"
                ? "font"
                : type === "document"
                  ? "doc"
                  : "other";
      bytes[key] += size;
      if (type === "script") files.push([responseBodySize, req.url().split("/").pop()]);
    } catch {
      /* a request that vanished mid-flight isn't a measurement */
    }
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: PROFILE.rtt,
    downloadThroughput: PROFILE.down,
    uploadThroughput: PROFILE.up,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: PROFILE.cpu });

  const t0 = Date.now();
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });

  // Wait for hydration, but bounded — a route that never hydrates is a result,
  // not a hang.
  await page
    .waitForFunction(() => window.__perf?.marks?.hydrated != null, null, {
      timeout: 60_000,
    })
    .catch(() => {});
  // A beat past hydration so the long-task tally covers the hydration work
  // itself rather than stopping in the middle of it.
  await page.waitForTimeout(1500);

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] ?? {};
    // THE BYTES THAT STAND BETWEEN A VISITOR AND A WORKING PAGE.
    //
    // Total transfer is the wrong number for this pass. Splitting a chunk out
    // of the critical path does not delete it — the print document and the
    // mobile sheets still arrive, just after the composer works — so a
    // whole-load byte count barely moves while the thing being fixed halves.
    // This counts only what finished downloading before the hydration mark.
    const mark = window.__perf?.marks?.hydrated;
    const blocking = { js: 0, css: 0, image: 0, font: 0, all: 0 };
    if (mark != null) {
      for (const r of performance.getEntriesByType("resource")) {
        if (r.responseEnd > mark) continue;
        const size = r.encodedBodySize || r.transferSize || 0;
        const key =
          r.initiatorType === "script" || r.name.endsWith(".js")
            ? "js"
            : r.name.endsWith(".css")
              ? "css"
              : /\.(avif|png|jpg|jpeg|svg|webp)$/.test(r.name)
                ? "image"
                : /\.woff2?$/.test(r.name)
                  ? "font"
                  : null;
        if (key) blocking[key] += size;
        blocking.all += size;
      }
    }
    const paints = Object.fromEntries(
      performance.getEntriesByType("paint").map((p) => [p.name, p.startTime]),
    );
    return {
      ttfb: nav.responseStart ?? null,
      fcp: paints["first-contentful-paint"] ?? null,
      lcp: window.__perf?.lcp || null,
      lcpEl: window.__perf?.lcpEl || '',
      domContentLoaded: nav.domContentLoadedEventEnd ?? null,
      load: nav.loadEventEnd ?? null,
      hydrated: window.__perf?.marks?.hydrated ?? null,
      hydratedFlag: window.__perf?.marks?.flag ?? null,
      longTasks: window.__perf?.longTasks ?? 0,
      longTaskMs: Math.round(window.__perf?.longTaskMs ?? 0),
      blocking,
    };
  });

  // THE NUMBER THIS SCRIPT EXISTS FOR: how long the page looks usable and
  // isn't. From the first contentful paint to the frame hydration lands.
  m.deadWindow =
    m.fcp != null && m.hydrated != null ? Math.max(0, m.hydrated - m.fcp) : null;
  m.wall = Date.now() - t0;
  m.bytes = bytes;
  m.files = files.sort((a, z) => z[0] - a[0]);

  await context.close();
  return m;
}

async function portBusy(port) {
  // A raw TCP connect, not a fetch. Node's fetch honours HTTPS_PROXY, and in a
  // sandbox that proxies everything a request to localhost comes back answered
  // by the proxy — so the check called every port busy, including the free
  // ones. What is being asked here is "will something accept a connection on
  // this port", and that is a socket question.
  return new Promise((resolve) => {
    const socket = connect({ port, host: "127.0.0.1" });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

/**
 * The first port at or above `from` that nothing is listening on.
 *
 * Not a nicety. Next shifts to the next free port when the requested one is
 * taken and says so in a line that is easy not to read; point the browser at
 * the port that was ASKED for and you measure whatever else is there —
 * typically a server an earlier run left behind, serving a build whose chunk
 * files the rebuild has since deleted. That produced a full page of confident
 * numbers for a page that never hydrated, and they looked like a spectacular
 * improvement. Twice. So: start on a port nothing is on, and read back the one
 * Next actually bound (startServer).
 */
async function freePort(from) {
  for (let port = from; port < from + 40; port += 1) {
    if (!(await portBusy(port))) return port;
  }
  throw new Error(`no free port in ${from}–${from + 40}`);
}

let server = null;
let base = BASE;
if (!external) {
  const port = await freePort(PORT);
  process.stdout.write(`starting next start on :${port} … `);
  const started = await startServer(port);
  server = started.proc;
  base = `http://localhost:${started.port}`;
  console.log("ready");
}

const browser = await chromium.launch();
const results = {};

console.log(`\nprofile: ${PROFILE.name}, ${RUNS} runs per route, median reported`);
console.log(`base:    ${base}\n`);

for (const route of routes) {
  const url = `${base}${route.startsWith("/") ? route : `/${route}`}`;
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) runs.push(await measure(browser, url));

  const pick = (k) => median(runs.map((r) => r[k]));
  const row = {
    ttfb: pick("ttfb"),
    fcp: pick("fcp"),
    lcp: pick("lcp"),
    hydrated: pick("hydrated"),
    deadWindow: pick("deadWindow"),
    load: pick("load"),
    longTasks: pick("longTasks"),
    longTaskMs: pick("longTaskMs"),
    lcpEl: runs[runs.length - 1].lcpEl,
    bytes: runs[runs.length - 1].bytes,
    blocking: runs[runs.length - 1].blocking,
    files: runs[runs.length - 1].files,
  };
  results[route] = row;

  console.log(`── ${route}`);
  console.log(`   ttfb            ${fmt(row.ttfb)} ms`);
  console.log(`   fcp             ${fmt(row.fcp)} ms`);
  console.log(`   lcp             ${fmt(row.lcp)} ms   (${row.lcpEl || "?"})`);
  console.log(
    `   hydrated        ${fmt(row.hydrated)} ms${row.hydrated == null ? "   NEVER — the page did not become interactive" : ""}`,
  );
  console.log(`   DEAD WINDOW     ${fmt(row.deadWindow)} ms   (fcp → hydrated)`);
  console.log(`   load            ${fmt(row.load)} ms`);
  console.log(`   long tasks      ${fmt(row.longTasks)} (${fmt(row.longTaskMs)} ms total)`);
  console.log(
    `   before interact js ${kb(row.blocking.js)} · css ${kb(row.blocking.css)} · img ${kb(
      row.blocking.image,
    )} · font ${kb(row.blocking.font)}  = ${kb(row.blocking.all)}`,
  );
  console.log(
    `   whole load      js ${kb(row.bytes.js)} · css ${kb(row.bytes.css)} · img ${kb(
      row.bytes.image,
    )} · font ${kb(row.bytes.font)} · doc ${kb(row.bytes.doc)}`,
  );
  if (flags.has("--files")) {
    for (const [n, name] of row.files.slice(0, 12)) {
      console.log(`     ${String(Math.round(n / 1024)).padStart(5)} kB  ${name}`);
    }
  }
  console.log("");
}

await browser.close();
if (server) server.kill("SIGTERM");

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ profile: PROFILE.name, results }, null, 2));
  console.log(`wrote ${jsonOut}`);
}
