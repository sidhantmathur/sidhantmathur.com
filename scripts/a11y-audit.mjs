// Keyboard and screen-reader audit. Tabs through each route in Chromium and
// reports, per stop:
//
//   name     whether the control has an accessible name
//   focus    whether anything visible changes on focus, by diffing the
//            element's computed style against the same element unfocused, and
//            whether the indicator uses the site's accent
//   order    the tab sequence itself, printed
//
// Real Tab presses rather than element.focus(), because Chrome matches
// `:focus-visible` only for keyboard-driven focus.
//
// When / is audited it also checks, with /api/chat mocked, what a failed turn
// and a completed turn announce; with --mobile it checks focus management in
// the navigation sheet.
//
// Usage:
//   node scripts/a11y-audit.mjs                 # / at desktop
//   node scripts/a11y-audit.mjs / --mobile
//   node scripts/a11y-audit.mjs /resume /colophon
//   BASE=https://<preview>.vercel.app node scripts/a11y-audit.mjs
//
// Without BASE it runs `next start` on a free port from 3300 (PORT to change),
// so it needs a production build. Exits 1 if any stop or check fails.

import { spawn } from "node:child_process";
import { connect } from "node:net";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const routes = args.filter((a) => !a.startsWith("--"));
if (routes.length === 0) routes.push("/");

const mobile = flags.has("--mobile");
const PORT = Number(process.env.PORT ?? 3300);
const external = Boolean(process.env.BASE);
const MAX_STOPS = 60;

// The properties a focus indicator can plausibly live in. If none of these
// differ between focused and unfocused, there is no indicator.
const FOCUS_PROPS = [
  "outlineStyle",
  "outlineWidth",
  "outlineColor",
  "outlineOffset",
  "boxShadow",
  "borderTopColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderRightColor",
  "borderTopWidth",
  "backgroundColor",
  "color",
  "textDecorationLine",
  "opacity",
  "position",
];


// --accent in app/globals.css. A focus style in any other colour is either a
// browser default or a second design.
const ACCENT_RGB = "rgb(228, 82, 43)";
const ACCENT_PROPS = [
  "borderTopColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderRightColor",
  "color",
  "backgroundColor",
];

function isTransparent(color) {
  if (!color) return true;
  if (color === "transparent") return true;
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return false;
  const parts = m[1].split(",").map((n) => parseFloat(n));
  return parts.length > 3 && parts[3] === 0;
}

function isAccent(color) {
  return typeof color === "string" && color.startsWith(ACCENT_RGB);
}

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

let server = null;
let base = process.env.BASE?.replace(/\/$/, "");
if (!external) {
  const port = await freePort(PORT);
  const started = await startServer(port);
  server = started.proc;
  base = `http://localhost:${started.port}`;
}

// CHROMIUM_PATH points at a preinstalled browser when the pinned one isn't
// downloaded, as in a cloud sandbox (/opt/pw-browsers/chromium).
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  isMobile: mobile,
  hasTouch: mobile,
  colorScheme: "dark",
});
const page = await context.newPage();

let problems = 0;

for (const route of routes) {
  const url = `${base}${route.startsWith("/") ? route : `/${route}`}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(700);

  // Pass one: tag every focusable element and record its unfocused style.
  const baseline = await page.evaluate((props) => {
    const sel = [
      "a[href]",
      "button",
      "input",
      "select",
      "textarea",
      // Focusable, and the measurements page uses it for its collapsible
      // groups; without a baseline there is nothing to diff against.
      "summary",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    const out = {};
    let i = 0;
    for (const el of document.querySelectorAll(sel)) {
      el.setAttribute("data-a11y-idx", String(i));
      const cs = getComputedStyle(el);
      const style = {};
      for (const p of props) style[p] = cs[p];
      out[i] = style;
      i += 1;
    }
    return out;
  }, FOCUS_PROPS);

  // Pass two: walk it with the keyboard.
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press("Tab");
  // The same settle the loop gives every other stop (see below).
  await page.waitForTimeout(400);

  const stops = [];
  const seen = new Set();
  for (let n = 0; n < MAX_STOPS; n += 1) {
    const stop = await page.evaluate((props) => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const cs = getComputedStyle(el);
      const style = {};
      for (const p of props) style[p] = cs[p];
      const rect = el.getBoundingClientRect();

      // An approximation of the accessible name, in precedence order.
      const labelledby = el.getAttribute("aria-labelledby");
      const fromLabelledby = labelledby
        ? labelledby
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
            .join(" ")
            .trim()
        : "";
      const wrappingLabel = el.closest("label")?.textContent?.trim() ?? "";
      const tag = el.tagName.toLowerCase();

      // Only some roles take their name from their content. A focusable scroll
      // region (a <pre>, a table wrapper) would otherwise borrow the text inside
      // it and never be reported as unnamed, and a <select>'s option text is
      // not its name.
      const namesFromContent = ["a", "button", "summary", "th", "td"].includes(tag);
      const isFormControl = ["input", "select", "textarea"].includes(tag);
      const name =
        el.getAttribute("aria-label")?.trim() ||
        fromLabelledby ||
        wrappingLabel ||
        (namesFromContent ? (el.textContent ?? "").replace(/\s+/g, " ").trim() : "") ||
        (isFormControl ? el.getAttribute("placeholder")?.trim() || "" : "") ||
        el.getAttribute("title")?.trim() ||
        el.getAttribute("alt")?.trim() ||
        "";

      return {
        idx: el.getAttribute("data-a11y-idx"),
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") ?? "",
        name,
        style,
        // Off-screen is not invisible: the skip link is off-screen until
        // focused, and appearing is its focus indicator.
        offscreen: rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > innerHeight,
        matchesFocusVisible: el.matches(":focus-visible"),
      };
    }, FOCUS_PROPS);

    if (!stop) break;
    const key = `${stop.idx}`;
    if (stop.idx != null && seen.has(key)) break; // wrapped round
    if (stop.idx != null) seen.add(key);
    stops.push(stop);
    await page.keyboard.press("Tab");
    // Long enough for `transition-colors` to finish; sampled mid-fade, the
    // ring reads as a colour that isn't the accent.
    await page.waitForTimeout(400);
  }

  console.log(`\n── ${route}  (${mobile ? "390x844" : "1280x800"})  ${stops.length} tab stops\n`);

  for (const [i, s] of stops.entries()) {
    const before = s.idx != null ? baseline[s.idx] : null;
    const changed = before ? FOCUS_PROPS.filter((p) => before[p] !== s.style[p]) : [];

    // A changed property is not an indicator: an outline's colour or width can
    // change on focus while its style is `none` or its colour transparent, and
    // nothing shows. So the outline must be visible before it counts.
    const visibleOutline =
      s.style.outlineStyle !== "none" &&
      parseFloat(s.style.outlineWidth) > 0 &&
      !isTransparent(s.style.outlineColor);
    const nonOutline = changed.filter((p) => !p.startsWith("outline"));
    // `before` is null for a stop the baseline pass never tagged: Chrome makes
    // scrollable regions focusable so the arrow keys can scroll them, and no
    // selector list predicts those. With nothing to diff against, a visible
    // outline counts on its own.
    const hasIndicator = before
      ? nonOutline.length > 0 || (changed.length > 0 && visibleOutline)
      : visibleOutline;

    // Focus indicators should use the accent; a browser-default ring is flagged.
    const accented =
      isAccent(s.style.outlineColor) ||
      ACCENT_PROPS.some((p) => changed.includes(p) && isAccent(s.style[p])) ||
      (changed.includes("boxShadow") && s.style.boxShadow.includes(ACCENT_RGB));

    const named = s.name.length > 0;

    const flags = [];
    if (!hasIndicator) flags.push("NO FOCUS INDICATOR");
    else if (!accented) flags.push("default ring, not the site's accent");
    if (!named) flags.push("NO ACCESSIBLE NAME");
    if (flags.length) problems += 1;

    const label = s.name.length > 44 ? `${s.name.slice(0, 43)}…` : s.name;
    console.log(
      `  ${String(i + 1).padStart(2)}. ${s.tag.padEnd(8)} ${JSON.stringify(label).padEnd(46)} ` +
        `${
          flags.length
            ? `FAIL  ${flags.join(" + ")}  outline=${s.style.outlineWidth} ${s.style.outlineStyle} ${s.style.outlineColor}`
            : `ok    [${(nonOutline.length ? nonOutline : changed).join(", ")}]`
        }`,
    );
  }
}

// ---------------------------------------------------------------------------
// Sheet focus management
// ---------------------------------------------------------------------------
// Below lg the rail and the context panel become Radix dialogs. Focus has to
// move into a dialog when it opens, stay inside while it is open, and return to
// whatever opened it when it closes; none of that can be read off the markup.
// Only the navigation sheet is exercised.
if (mobile && routes.includes("/")) {
  console.log("\n── sheet focus management (390x844)\n");
  const url = `${base}/`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(900);

  const sheetChecks = [];
  const note = (name, pass, detail = "") => {
    sheetChecks.push(pass);
    if (!pass) problems += 1;
    console.log(`  ${pass ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  };

  // Open it the way a keyboard user would: focus the trigger, press Enter.
  const trigger = page.locator('button[aria-label="Open the index"]');
  await trigger.focus();
  const triggerWasFocused = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-label") === "Open the index",
  );
  note("the navigation trigger can be focused", triggerWasFocused);

  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);

  const inside = await page.evaluate(() => {
    const dialog = document.querySelector('[data-slot="sheet-content"]');
    return {
      open: Boolean(dialog),
      focusInside: Boolean(dialog && dialog.contains(document.activeElement)),
      role: dialog?.getAttribute("role") ?? "",
      // Radix makes a dialog modal by setting aria-hidden on its siblings
      // rather than aria-modal on itself, so either counts: the question is
      // whether assistive tech can still reach the shell behind the sheet.
      modal:
        dialog?.getAttribute("aria-modal") === "true" ||
        document.querySelector(".screen-only")?.getAttribute("aria-hidden") === "true",
      behindHidden: document.querySelector(".screen-only")?.getAttribute("aria-hidden") ?? "(not hidden)",
      labelled: Boolean(
        dialog?.getAttribute("aria-label") || dialog?.getAttribute("aria-labelledby"),
      ),
    };
  });
  note("Enter on the trigger opens the sheet", inside.open);
  note("focus moves into the sheet", inside.focusInside);
  note(
    "the sheet is modal — the page behind it is hidden from assistive tech",
    inside.role === "dialog" && inside.modal === true,
    `role=${inside.role} .screen-only aria-hidden=${inside.behindHidden}`,
  );
  note("the sheet has an accessible name", inside.labelled);

  // Tab all the way round and confirm nothing outside it is ever reached.
  let escaped = false;
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(40);
    const out = await page.evaluate(() => {
      const dialog = document.querySelector('[data-slot="sheet-content"]');
      const el = document.activeElement;
      if (!dialog || !el || el === document.body) return false;
      return !dialog.contains(el);
    });
    if (out) {
      escaped = true;
      break;
    }
  }
  note("focus is trapped inside the open sheet", !escaped, escaped ? "tabbed out of it" : "30 tab presses");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  const restored = await page.evaluate(() => ({
    closed: !document.querySelector('[data-slot="sheet-content"]'),
    back: document.activeElement?.getAttribute("aria-label") === "Open the index",
    landedOn:
      document.activeElement?.getAttribute("aria-label") ||
      document.activeElement?.tagName ||
      "nothing",
  }));
  note("Escape closes the sheet", restored.closed);
  note("focus returns to the control that opened it", restored.back, `landed on ${restored.landedOn}`);
}

// ---------------------------------------------------------------------------
// What a failed turn announces
// ---------------------------------------------------------------------------
// The error block carries role="alert", but an alert only announces when the
// element enters the accessibility tree or its text changes. One that was
// always in the DOM and merely revealed says nothing, so this checks that none
// exists before the failure.
//
// /api/chat is mocked so the failure happens whether or not the server has
// AI_GATEWAY_API_KEY, including against a BASE deploy. The cases take
// different client paths:
//
//   upstream_unconfigured  an HTTP error with a class in the body, as a keyless
//                          deploy returns
//   network                the request never completes, so the fetch in
//                          guardedFetch (lib/chat-transport.ts) throws rather
//                          than returning a non-ok response
//   invalid_request        the one class with no retry button, by policy; the
//                          check is inverted to assert that
//   empty_answer           see below
const FAILURE_CASES = [
  {
    label: "upstream_unconfigured",
    handle: (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "upstream_unconfigured" }),
      }),
    wayOut: true,
  },
  {
    label: "network",
    handle: (route) => route.abort(),
    wayOut: true,
  },
  {
    label: "invalid_request",
    handle: (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_request" }),
      }),
    wayOut: false,
  },
  // No error on the wire: an HTTP 200 whose turn reasons and finishes without
  // any text, as a reasoning model can when it spends the output cap thinking.
  // The alert has to come from the client transport noticing the empty turn.
  {
    label: "empty_answer",
    handle: (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
        },
        body:
          [
            { type: "start" },
            { type: "reasoning-start", id: "r1" },
            { type: "reasoning-delta", id: "r1", delta: "Thinking about the question…" },
            { type: "reasoning-end", id: "r1" },
            { type: "finish" },
          ]
            .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
            .join("") + "data: [DONE]\n\n",
      }),
    wayOut: true,
  },
];

if (routes.includes("/")) {
  console.log("\n── what a failed turn announces\n");
  const note = (name, pass, detail = "") => {
    if (!pass) problems += 1;
    console.log(`  ${pass ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  };

  for (const failure of FAILURE_CASES) {
    await page.route("**/api/chat", failure.handle);

    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    // The composer is disabled until hydration.
    await page.waitForSelector("#ask:not([disabled])", { timeout: 60_000 });

    const alertBefore = await page.evaluate(
      () => document.querySelectorAll("[role=alert]").length,
    );
    note(
      `${failure.label} · no alert is in the DOM before anything fails`,
      alertBefore === 0,
      `${alertBefore} found`,
    );

    await page.fill("#ask", "What has he shipped?");
    await page.keyboard.press("Enter");
    await page.waitForSelector("[role=alert]", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(500);

    const after = await page.evaluate(() => {
      const alert = document.querySelector("[role=alert]");
      const status = document.querySelector("[role=status][aria-live=polite]");
      return {
        alert: Boolean(alert),
        alertText: (alert?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
        retryNamed: Boolean(
          [...(alert?.querySelectorAll("button") ?? [])].some((b) => (b.textContent ?? "").trim()),
        ),
        statusExists: Boolean(status),
        // The polite region stays empty on a failure, or the failure is
        // announced twice.
        statusText: (status?.textContent ?? "").trim(),
      };
    });

    note(`${failure.label} · a failed turn puts an alert into the tree`, after.alert, after.alertText);
    if (failure.wayOut) {
      note(`${failure.label} · the alert offers a named way out`, after.retryNamed);
    } else {
      note(
        `${failure.label} · the alert deliberately offers no retry`,
        !after.retryNamed,
        after.retryNamed ? "a button appeared under copy that says not to resend" : "",
      );
    }
    note(`${failure.label} · the polite status region exists`, after.statusExists);
    note(
      `${failure.label} · the polite region stays quiet, so it is announced once`,
      after.statusText === "",
      after.statusText ? `said "${after.statusText}"` : "",
    );

    await page.unroute("**/api/chat", failure.handle);
  }
}

// ---------------------------------------------------------------------------
// What a completed turn announces
// ---------------------------------------------------------------------------
// A streamed answer arrives silently, so a finished turn needs a polite
// announcement. The stream is mocked: it runs without AI_GATEWAY_API_KEY, and
// it arrives all at once, the fast turn where the whole answer lands in one
// render batch. An announcement keyed to a busy-to-idle transition sees no
// intermediate commit there and says nothing.
if (routes.includes("/")) {
  console.log("\n── what a completed turn announces\n");
  const note = (name, pass, detail = "") => {
    if (!pass) problems += 1;
    console.log(`  ${pass ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  };

  const SSE =
    [
      '{"type":"start"}',
      '{"type":"start-step"}',
      '{"type":"text-start","id":"t0"}',
      '{"type":"text-delta","id":"t0","delta":"He shipped A Darle 20 end to end."}',
      '{"type":"text-end","id":"t0"}',
      '{"type":"finish-step"}',
      '{"type":"finish"}',
    ]
      .map((d) => `data: ${d}\n\n`)
      .join("") + "data: [DONE]\n\n";

  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
      body: SSE,
    }),
  );

  await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#ask:not([disabled])", { timeout: 60_000 });
  await page.fill("#ask", "What has he shipped?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3500);

  const turn = await page.evaluate(() => ({
    status: (
      document.querySelector("[role=status][aria-live=polite]")?.textContent ?? ""
    ).trim(),
    answerShown: document.body.innerText.includes("A Darle 20 end to end"),
    alerts: document.querySelectorAll("[role=alert]").length,
    // An answer inside a live region would be read again on every token.
    answerInLiveRegion: [...document.querySelectorAll("[aria-live]")].some((r) =>
      (r.textContent ?? "").includes("A Darle 20 end to end"),
    ),
  }));

  note("the answer renders", turn.answerShown);
  note("a completed turn is announced politely", /complete/i.test(turn.status), turn.status || "said nothing");
  note("a successful turn raises no alert", turn.alerts === 0);
  note("the answer text is NOT inside a live region", !turn.answerInLiveRegion);
  await page.unroute("**/api/chat");
}

await browser.close();
if (server) stopServer(server);

console.log(`\n${problems} problem stop(s)\n`);
process.exit(problems ? 1 : 0);
