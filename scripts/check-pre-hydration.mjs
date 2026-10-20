// Checks what the homepage does before its JavaScript arrives.
// scripts/perf.mjs measures how long that window is; this asserts what happens
// inside it, on a heavily throttled mobile load, after confirming the page has
// not hydrated yet:
//
//   - the composer, the send button and the suggested chips are disabled, and
//     the status strip and placeholder say "loading"
//   - a forced click or requestSubmit on send does not navigate (a native GET
//     submit would throw away the load in progress)
//   - nothing that needs JavaScript is reachable by Tab
//
// Then it waits for hydration and checks every control is live again: a gate
// that never opens would pass all of the above.
//
// Usage:  node scripts/check-pre-hydration.mjs
//         BASE=https://<preview>.vercel.app node scripts/check-pre-hydration.mjs
//
// Without BASE it runs `next start` on a free port from 3200 (PORT to change),
// so it needs a production build. Exits 1 if any check fails.

import { spawn } from "node:child_process";
import { connect } from "node:net";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT ?? 3200);
const external = Boolean(process.env.BASE);

// Slower than the perf profile on purpose: the goal is to be well inside the
// pre-hydration window when the assertions run, not to model a real connection.
const NET = { latency: 300, down: (700 * 1024) / 8, up: (300 * 1024) / 8 };
const CPU = 6;

function portBusy(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: "127.0.0.1" });
    const done = (r) => {
      socket.destroy();
      resolve(r);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function freePort(from) {
  for (let p = from; p < from + 40; p += 1) if (!(await portBusy(p))) return p;
  throw new Error("no free port");
}

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

async function startServer(port) {
  const proc = spawn("npx", ["next", "start", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
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
  });
  return { proc, port: bound };
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "  ok  " : "  FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

let server = null;
let base = process.env.BASE?.replace(/\/$/, "");
if (!external) {
  const port = await freePort(PORT);
  const started = await startServer(port);
  server = started.proc;
  base = `http://localhost:${started.port}`;
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
});
const page = await context.newPage();

const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: NET.latency,
  downloadThroughput: NET.down,
  uploadThroughput: NET.up,
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

console.log(`\npre-hydration checks against ${base}\n`);

// `domcontentloaded`, because `load` would wait for the JavaScript.
await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForSelector("#ask", { state: "attached", timeout: 60_000 });

// If hydration has already landed, every assertion below passes or fails for
// the wrong reason.
const stillCold = await page.evaluate(
  () => document.documentElement.dataset.hydrated !== "true",
);
check("the page is still pre-hydration when the checks run", stillCold);

const before = await page.evaluate(() => {
  const ask = document.getElementById("ask");
  const form = ask?.closest("form");
  const send = form?.querySelector('button[type="submit"]');
  const chips = [...document.querySelectorAll("button")].filter((b) =>
    /short version|shipped end to end/i.test(b.textContent ?? ""),
  );
  return {
    askDisabled: Boolean(ask?.disabled),
    sendDisabled: Boolean(send?.disabled),
    chipCount: chips.length,
    chipsDisabled: chips.length > 0 && chips.every((c) => c.disabled),
    formAction: form?.getAttribute("action") ?? null,
    formMethod: form?.getAttribute("method") ?? null,
    // innerText, so a string hidden by a media query does not count as shown.
    statusText: document.body.innerText.toLowerCase().includes("loading"),
    placeholder: ask?.getAttribute("placeholder") ?? "",
  };
});

check("the composer is disabled", before.askDisabled);
check("the send button is disabled", before.sendDisabled, "no native submit possible");
check("the suggested chips are disabled", before.chipsDisabled, `${before.chipCount} found`);
check("the status strip says loading, not ready", before.statusText);
check(
  "the composer says what it is doing",
  /loading/i.test(before.placeholder),
  JSON.stringify(before.placeholder),
);

// Click from script, past the disabled attribute's pointer handling, and
// confirm the page does not navigate.
const urlBefore = page.url();
let navigated = false;
page.once("framenavigated", (f) => {
  if (f === page.mainFrame()) navigated = true;
});
await page
  .evaluate(() => {
    const form = document.getElementById("ask")?.closest("form");
    form?.querySelector('button[type="submit"]')?.click();
    // And submit the form directly, as an Enter keypress would.
    if (form && typeof form.requestSubmit === "function") {
      try {
        form.requestSubmit();
      } catch {
        /* a form with a disabled submitter refusing is the correct outcome */
      }
    }
  })
  .catch(() => {});
// Generous on purpose: at 300ms RTT a same-URL GET takes well over half a
// second to commit, and a 500ms wait missed a navigation already under way.
await page.waitForTimeout(3000);
check(
  "clicking send before hydration does not navigate",
  !navigated && page.url() === urlBefore,
  page.url() === urlBefore ? "" : `url became ${page.url()}`,
);

// The keyboard half of the gate. `pointer-events: none` stops only a tap: a
// control gated in CSS alone stays in the tab order, where Enter silently does
// nothing.
const reachable = [];
for (let i = 0; i < 25; i += 1) {
  await page.keyboard.press("Tab");
  const stop = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName.toLowerCase(),
      js: el.hasAttribute("data-js-control"),
      href: el.getAttribute("href"),
      name:
        el.getAttribute("aria-label") ||
        (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
    };
  });
  if (!stop) break;
  // A link is fine: before hydration it navigates to a server-rendered page.
  if (stop.js && !stop.href) reachable.push(stop.name || stop.tag);
}
check(
  "nothing that needs JavaScript is reachable by Tab before hydration",
  reachable.length === 0,
  reachable.length ? `reached ${reachable.join(", ")}` : "",
);

// Let hydration finish and confirm the gate opens.
await page.waitForFunction(
  () => document.documentElement.dataset.hydrated === "true",
  null,
  { timeout: 120_000 },
);
await page.waitForTimeout(300);

const after = await page.evaluate(() => {
  const ask = document.getElementById("ask");
  const chips = [...document.querySelectorAll("button")].filter((b) =>
    /short version|shipped end to end/i.test(b.textContent ?? ""),
  );
  return {
    askEnabled: ask && !ask.disabled,
    chipsEnabled: chips.length > 0 && chips.every((c) => !c.disabled),
    placeholder: ask?.getAttribute("placeholder") ?? "",
    // Below sm the hydrated status is a dot rather than a word, so this checks
    // that "loading" is gone rather than that "ready" appears.
    ready: !document.body.innerText.toLowerCase().includes("loading"),
  };
});

check("the composer is live after hydration", Boolean(after.askEnabled));
check("the chips are live after hydration", after.chipsEnabled);
check("the placeholder returns to the question prompt", /Ask a question/i.test(after.placeholder));
check("the loading label is gone after hydration", after.ready);

await page.fill("#ask", "hello");
const sendLive = await page.evaluate(() => {
  const form = document.getElementById("ask")?.closest("form");
  return !form?.querySelector('button[type="submit"]')?.disabled;
});
check("the send button enables once there is something to send", sendLive);

await browser.close();
if (server) stopServer(server);

const failed = results.filter((r) => !r.pass);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed\n`,
);
process.exit(failed.length ? 1 : 0);
