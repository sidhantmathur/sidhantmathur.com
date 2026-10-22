// Throttled first-load measurement. On a slow connection the page paints long
// before it hydrates and looks usable while every tap goes nowhere; the main
// number here is that dead window, from first contentful paint to hydration.
// scripts/check-pre-hydration.mjs asserts what the page does inside it.
//
// Drives Chromium over CDP with CPU and network throttling applied before the
// first navigation, against `next start` on the production build. A dev server
// would measure Turbopack, not the site.
//
// Usage:
//   node scripts/perf.mjs                       # / and /resume, mobile profile
//   node scripts/perf.mjs / /resume /colophon
//   node scripts/perf.mjs --desktop
//   node scripts/perf.mjs --json out.json       # machine-readable, for diffing
//   BASE=https://<preview>.vercel.app node scripts/perf.mjs
//
// With BASE set it measures that server; otherwise it starts `next start` on
// the first free port from 3100 (PORT to change), which needs a production
// build. RUNS sets loads per route (default 3; medians are reported) and
// --files lists the largest scripts. It reports numbers and asserts nothing.

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

// The mobile profile is Lighthouse's "slow 4G" (1.6 Mbps down, 750 Kbps up,
// 150ms RTT) plus a 4x CPU slowdown, roughly a mid-tier Android. Changing it
// makes every earlier before/after number incomparable.
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
 * Injected before any page script. Records when the document becomes
 * interactive, which React does not report and no Web Vital covers, from two
 * signals:
 *
 *   react   React writes `__reactProps$…` / `__reactFiber$…` onto a DOM node
 *           when it hydrates it, and server HTML carries no such key. Works on
 *           any build, with or without the app's own flag.
 *   flag    `<html data-hydrated="true">`, set by the app, which keys its own
 *           pre-hydration gate to it. It should land on the same frame; the two
 *           marks disagreeing means the flag is wrong.
 *
 * Polled on rAF rather than an interval: the main thread is blocked during
 * hydration, and the first rAF after it clears is the moment being measured.
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

// `npx` runs next through a shell, so killing only the spawned process leaves
// the server holding its port. The server gets its own process group and the
// whole group is stopped. A separate group doesn't receive the terminal's
// Ctrl-C, so that is forwarded by hand.
function stopServer(proc) {
  try {
    process.kill(-proc.pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}

/**
 * Starts `next start` and returns the port it actually bound to, parsed from
 * Next's output. If the requested port is taken, Next silently moves to
 * another, and measuring the requested one would measure whatever stale server
 * holds it.
 */
async function startServer(port) {
  const proc = spawn("npx", ["next", "start", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env },
  });
  process.once("exit", () => stopServer(proc));
  process.once("SIGINT", () => {
    stopServer(proc);
    process.exit(130);
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

  // Bytes over the wire by type, from `request.sizes()` on `requestfinished`:
  // the encoded size, which is what costs the visitor time.
  //
  // Not from a `response` handler awaiting `res.body()`: reading a body inside
  // that event holds the response open, which deadlocks a throttled load.
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

  // Bounded: a route that never hydrates is a result, not a hang.
  await page
    .waitForFunction(() => window.__perf?.marks?.hydrated != null, null, {
      timeout: 60_000,
    })
    .catch(() => {});
  // Past hydration, so the long-task tally covers all of the hydration work.
  await page.waitForTimeout(1500);

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] ?? {};
    // Bytes that finished downloading before the hydration mark. Total
    // transfer hides a chunk split out of the critical path, since the chunk
    // still arrives later; this is what stands between a visitor and a
    // working page.
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

  // How long the page looks usable and isn't: first contentful paint to
  // hydration.
  m.deadWindow =
    m.fcp != null && m.hydrated != null ? Math.max(0, m.hydrated - m.fcp) : null;
  m.wall = Date.now() - t0;
  m.bytes = bytes;
  m.files = files.sort((a, z) => z[0] - a[0]);

  await context.close();
  return m;
}

async function portBusy(port) {
  // A raw TCP connect, not a fetch: in a sandbox that sets HTTPS_PROXY, the
  // proxy answers a fetch to localhost and every port looks busy.
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
 * The first port at or above `from` that nothing is listening on. A server
 * left on the requested port by an earlier run serves a build whose chunks may
 * since have been deleted, which measures as a fast page that never hydrates.
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

// CHROMIUM_PATH points at a preinstalled browser when the pinned one isn't
// downloaded, as in a cloud sandbox (/opt/pw-browsers/chromium).
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
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
if (server) stopServer(server);

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ profile: PROFILE.name, results }, null, 2));
  console.log(`wrote ${jsonOut}`);
}
