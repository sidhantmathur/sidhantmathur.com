// What a keyboard and a screen reader hit, reported the same way `npm run shot`
// reports what eyes hit.
//
// This drives a real Chromium, tabs through a route the way a keyboard user
// does, and answers three questions per stop:
//
//   name     does the control say what it is? An icon-only button with no
//            accessible name is a button announced as "button".
//   focus    does anything on screen CHANGE when it receives focus? Measured by
//            diffing the element's computed style against the same element
//            unfocused — outline, box-shadow, border, colours, background. A
//            control whose style is byte-identical focused and unfocused is
//            invisible to a keyboard, whatever it looks like under a mouse.
//   order    the sequence itself, printed, so a reader can see whether tabbing
//            through the shell follows the page or wanders.
//
// WHY REAL TAB PRESSES rather than element.focus(): `:focus-visible` is the
// selector a well-behaved focus style uses, and Chrome only matches it for
// keyboard-driven focus. A JS focus() call would report every such style as
// missing. So the walk is Tab, Tab, Tab, and the styles are read off
// document.activeElement.
//
// Usage:
//   node scripts/a11y-audit.mjs                 # / at desktop
//   node scripts/a11y-audit.mjs / --mobile
//   node scripts/a11y-audit.mjs /resume /colophon
//   BASE=https://<preview>.vercel.app node scripts/a11y-audit.mjs

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


// --accent, the site's one accent colour (app/globals.css). A focus style that
// is not this is either a browser default or a second design.
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

  // Pass one: tag every focusable element and record it UNFOCUSED.
  const baseline = await page.evaluate((props) => {
    const sel = [
      "a[href]",
      "button",
      "input",
      "select",
      "textarea",
      // <summary> is focusable and this site uses it — the measurements page is
      // eleven collapsible eval groups. Leaving it off the baseline list meant
      // every one of them reported "no focus indicator" while wearing a
      // perfectly good accent ring, because there was nothing to diff against.
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
  // The same settle the loop gives every other stop. Without it the FIRST stop
  // was read mid-transition and reported its half-mixed ring as the wrong
  // colour — the audit accusing the site of a bug the audit had.
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

      // The accessible name, computed the way a screen reader would reach for
      // it, in precedence order.
      const labelledby = el.getAttribute("aria-labelledby");
      const fromLabelledby = labelledby
        ? labelledby
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
            .join(" ")
            .trim()
        : "";
      const wrappingLabel = el.closest("label")?.textContent?.trim() ?? "";
      const name =
        el.getAttribute("aria-label")?.trim() ||
        fromLabelledby ||
        (el.textContent ?? "").replace(/\s+/g, " ").trim() ||
        el.getAttribute("title")?.trim() ||
        el.getAttribute("alt")?.trim() ||
        el.getAttribute("placeholder")?.trim() ||
        wrappingLabel ||
        "";

      return {
        idx: el.getAttribute("data-a11y-idx"),
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") ?? "",
        name,
        style,
        // Off-screen is not the same as invisible: the skip link is meant to be
        // off-screen until focused, and that IS its focus indicator.
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
    // Long enough for `transition-colors` to finish. At 60ms the audit was
    // sampling the ring mid-fade and reporting a half-mixed accent as "not the
    // site's accent" — a measurement bug that looked exactly like a design bug.
    await page.waitForTimeout(400);
  }

  console.log(`\n── ${route}  (${mobile ? "390x844" : "1280x800"})  ${stops.length} tab stops\n`);

  for (const [i, s] of stops.entries()) {
    const before = s.idx != null ? baseline[s.idx] : null;
    const changed = before ? FOCUS_PROPS.filter((p) => before[p] !== s.style[p]) : [];

    // A CHANGED PROPERTY IS NOT AN INDICATOR. The first version of this script
    // passed every control on the site, including the composer, whose class
    // list contains `outline-none` — which in Tailwind v4 is a 2px TRANSPARENT
    // outline. Focusing it changes `outlineColor` and `outlineWidth`, so a
    // naive diff reports a focus style, and there is nothing on screen at all.
    // So the outline has to be shown to be visible before it counts.
    const visibleOutline =
      s.style.outlineStyle !== "none" &&
      parseFloat(s.style.outlineWidth) > 0 &&
      !isTransparent(s.style.outlineColor);
    const nonOutline = changed.filter((p) => !p.startsWith("outline"));
    // `before` is null for a stop the baseline pass never tagged — Chrome makes
    // scrollable regions and some <pre> blocks focusable so the arrow keys can
    // scroll them, and those are plain elements no focusable-selector list
    // predicts. With nothing to diff against, judge the focused state on its own
    // terms: a visible, accented outline is a focus indicator whether or not
    // this script saw the element beforehand. (Reporting those as "no focus
    // indicator" while they wore a perfectly good accent ring was this file
    // accusing the site of its own blind spot for the third time.)
    const hasIndicator = before
      ? nonOutline.length > 0 || (changed.length > 0 && visibleOutline)
      : visibleOutline;

    // And an indicator is not the same as the site's indicator. This site has
    // one accent and a policy of using it; a browser-default ring is a
    // different design arriving uninvited on a dark amber palette.
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
// The sheets, which are the one place focus can be lost outright
// ---------------------------------------------------------------------------
// Below lg the rail and the context panel become Radix dialogs. A dialog owes
// its user three things, and none of them can be settled by reading the markup:
// focus has to MOVE into it when it opens, has to STAY inside it while it is
// open, and has to COME BACK to whatever opened it when it closes. The third is
// the one that gets dropped, and dropping it strands a keyboard user at the top
// of the document with no idea where they are.
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
  const trigger = page.locator('button[aria-label="Open navigation"]');
  await trigger.focus();
  const triggerWasFocused = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-label") === "Open navigation",
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
      // Modality is what matters, not the attribute that usually expresses it.
      // Radix hides the rest of the page by marking the dialog's siblings
      // aria-hidden rather than by setting aria-modal, which is equivalent for
      // a screen reader and stricter for everything else. So the check is: can
      // assistive tech still reach the shell behind this sheet?
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
    back: document.activeElement?.getAttribute("aria-label") === "Open navigation",
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
// The error block carries role="alert", which is an assertive live region and
// should interrupt whatever a screen reader is saying. Carrying the attribute
// and actually announcing are not the same thing: an alert only fires when the
// element ENTERS the accessibility tree or its text changes, so an alert that
// was always in the DOM and merely revealed would say nothing at all.
//
// This sends a question and reads the result. Without AI_GATEWAY_API_KEY the
// route fails by design, which is exactly the state under test — so this check
// runs the same way with a key and without one, it just exercises a different
// error class.
if (routes.includes("/")) {
  console.log("\n── what a failed turn announces\n");
  const note = (name, pass, detail = "") => {
    if (!pass) problems += 1;
    console.log(`  ${pass ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  };

  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(900);

  const alertBefore = await page.evaluate(() => document.querySelectorAll("[role=alert]").length);
  note("no alert is in the DOM before anything fails", alertBefore === 0, `${alertBefore} found`);

  await page.fill("#ask", "What has he shipped?");
  await page.keyboard.press("Enter");
  await page
    .waitForSelector("[role=alert]", { timeout: 45_000 })
    .catch(() => {});
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
      // The polite region must stay EMPTY on a failure: the alert is the
      // announcement, and saying both is saying it twice.
      statusText: (status?.textContent ?? "").trim(),
    };
  });

  note("a failed turn puts an alert into the tree", after.alert, after.alertText);
  note("the alert offers a named way out", after.retryNamed);
  note("the polite status region exists", after.statusExists);
  note(
    "the polite region stays quiet on a failure, so it is announced once",
    after.statusText === "",
    after.statusText ? `said "${after.statusText}"` : "",
  );
}

// ---------------------------------------------------------------------------
// What a COMPLETED turn announces
// ---------------------------------------------------------------------------
// A streamed answer appears silently: the prose arrives a token at a time in
// the transcript, and a blind visitor had no way to know a turn had finished
// except by tabbing away and back to check.
//
// The answer stream is mocked rather than requested, for two reasons. It runs
// without AI_GATEWAY_API_KEY, and — more usefully — a mocked response arrives
// all at once, which is the FAST turn: the case where the whole answer lands
// inside a single render batch. An announcement keyed to a busy→idle
// transition has no intermediate commit to observe there and silently does
// nothing, which is precisely the bug this check found.
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
    // The answer must not itself sit inside a live region, or it is read once
    // per token as it streams.
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
if (server) server.kill("SIGKILL");

console.log(`\n${problems} problem stop(s)\n`);
process.exit(problems ? 1 : 0);
