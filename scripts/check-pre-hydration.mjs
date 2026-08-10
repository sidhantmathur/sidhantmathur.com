// Does the page tell the truth before its JavaScript arrives?
//
// scripts/perf.mjs measures how long that window is. This asserts what happens
// inside it, which is the half that actually bit someone: on a restaurant's
// wifi the shell painted a composer, a send button and four question chips
// several seconds before any of them worked, and every tap in between was
// swallowed without a mark. The send button was worse than inert — a submit
// inside a form with no action, so a press fired a native GET navigation that
// threw away the load it was waiting on.
//
// The checks below run against a real throttled load, at a moment chosen to be
// inside the window rather than assumed to be:
//
//   1. the composer is disabled, so it cannot take a question nothing can send
//   2. the send button is disabled, so no native submit is possible
//   3. the suggested chips are disabled
//   4. the status strip says "loading" rather than "ready"
//   5. a forced click on the send button does not navigate the page
//   6. after hydration, every one of those is live again
//
// Check 6 is not a formality. A gate that never opens is a worse bug than the
// one it fixed, and it would pass checks 1–5 perfectly.
//
// Usage:  node scripts/check-pre-hydration.mjs
//         BASE=https://<preview>.vercel.app node scripts/check-pre-hydration.mjs

import { spawn } from "node:child_process";
import { connect } from "node:net";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT ?? 3200);
const external = Boolean(process.env.BASE);

// Slower than the perf profile on purpose. The point here is to be standing
// comfortably inside the pre-hydration window when the assertions run, not to
// reproduce a representative connection.
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

async function startServer(port) {
  const proc = spawn("npx", ["next", "start", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  process.once("exit", () => proc.kill("SIGKILL"));
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

// Deliberately `domcontentloaded`: waiting for `load` would wait for the
// JavaScript, which is the thing this file exists to run ahead of.
await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForSelector("#ask", { state: "attached", timeout: 60_000 });

// Confirm the window is actually still open. If hydration has already landed,
// every assertion below would pass or fail for the wrong reason, and a green
// run would mean nothing at all.
const stillCold = await page.evaluate(
  () => document.documentElement.dataset.hydrated !== "true",
);
check("the page is still pre-hydration when the checks run", stillCold);

const before = await page.evaluate(() => {
  const ask = document.getElementById("ask");
  const form = ask?.closest("form");
  const send = form?.querySelector('button[type="submit"]');
  const chips = [...document.querySelectorAll("button")].filter((b) =>
    /30-second version|shipped end to end/i.test(b.textContent ?? ""),
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

// The one that matters most: force the click past the disabled attribute's
// pointer handling and confirm the page does not navigate. A disabled submit
// should be incapable of it; this proves it rather than trusting the spec.
const urlBefore = page.url();
let navigated = false;
page.once("framenavigated", (f) => {
  if (f === page.mainFrame()) navigated = true;
});
await page
  .evaluate(() => {
    const form = document.getElementById("ask")?.closest("form");
    form?.querySelector('button[type="submit"]')?.click();
    // And the harder version: ask the form to submit itself the way a stray
    // Enter keypress would have.
    if (form && typeof form.requestSubmit === "function") {
      try {
        form.requestSubmit();
      } catch {
        /* a form with a disabled submitter refusing is the correct outcome */
      }
    }
  })
  .catch(() => {});
// Generous, and deliberately so: at 300ms RTT on a throttled connection a
// same-URL GET takes well over half a second to commit, and a 500ms wait here
// reported "did not navigate" for a page that was already navigating. The
// check that catches a silent failure must not have one of its own.
await page.waitForTimeout(3000);
check(
  "clicking send before hydration does not navigate",
  !navigated && page.url() === urlBefore,
  page.url() === urlBefore ? "" : `url became ${page.url()}`,
);

// THE KEYBOARD HALF OF THE GATE. `pointer-events: none` stops a tap and nothing
// else — a control gated only in CSS stays in the tab order, so Enter on it is
// still a keystroke that silently does nothing, for the people least able to
// guess why. Nothing that needs JavaScript should be reachable by Tab yet.
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
  // An anchor is fine however it is gated: following it before hydration
  // navigates to a real server-rendered page, which is a working outcome.
  if (stop.js && !stop.href) reachable.push(stop.name || stop.tag);
}
check(
  "nothing that needs JavaScript is reachable by Tab before hydration",
  reachable.length === 0,
  reachable.length ? `reached ${reachable.join(", ")}` : "",
);

// Now let it finish, and confirm the gate opens.
await page.waitForFunction(
  () => document.documentElement.dataset.hydrated === "true",
  null,
  { timeout: 120_000 },
);
await page.waitForTimeout(300);

const after = await page.evaluate(() => {
  const ask = document.getElementById("ask");
  const chips = [...document.querySelectorAll("button")].filter((b) =>
    /30-second version|shipped end to end/i.test(b.textContent ?? ""),
  );
  return {
    askEnabled: ask && !ask.disabled,
    chipsEnabled: chips.length > 0 && chips.every((c) => !c.disabled),
    placeholder: ask?.getAttribute("placeholder") ?? "",
    // Below sm the settled design shows the status as a dot rather than a
    // word, so this asserts the word is GONE and the dot is what remains —
    // the pre-hydration "loading" collapsing back is the behaviour under test.
    ready: !document.body.innerText.toLowerCase().includes("loading"),
  };
});

check("the composer is live after hydration", Boolean(after.askEnabled));
check("the chips are live after hydration", after.chipsEnabled);
check("the placeholder returns to the question prompt", /Ask a question/i.test(after.placeholder));
check("the loading label is gone after hydration", after.ready);

// Typing into the live composer must enable the send button — the gate opening
// is only half of it; the control has to work.
await page.fill("#ask", "hello");
const sendLive = await page.evaluate(() => {
  const form = document.getElementById("ask")?.closest("form");
  return !form?.querySelector('button[type="submit"]')?.disabled;
});
check("the send button enables once there is something to send", sendLive);

await browser.close();
if (server) server.kill("SIGKILL");

const failed = results.filter((r) => !r.pass);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed\n`,
);
process.exit(failed.length ? 1 : 0);
