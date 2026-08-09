// Headless screenshots, so an agent working in a cloud sandbox can SEE this
// site instead of inferring it from the DOM.
//
// There is no browser pane in a headless environment, and a portfolio whose
// argument is craft cannot be reviewed through `read_page` output. This drives
// Chromium with no display, writes PNGs, and those PNGs are readable by an
// agent's vision and shareable straight into chat for approval from a phone.
//
// Usage:
//   node scripts/shot.mjs                      # / at desktop
//   node scripts/shot.mjs /resume /measurements
//   node scripts/shot.mjs / --mobile
//   node scripts/shot.mjs / --full             # grow the viewport to the content
//   BASE=https://<preview>.vercel.app node scripts/shot.mjs /
//
// Output lands in .screenshots/ (git-ignored). Requires a one-time
// `npx playwright install chromium` per environment.

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const OUT = ".screenshots";
const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const routes = args.filter((a) => !a.startsWith("--"));
if (routes.length === 0) routes.push("/");

const mobile = flags.has("--mobile");
const fullPage = flags.has("--full");
// 1280x800 desktop matches the browser-pane default so screenshots taken here
// and locally are comparable; 390x844 is a current iPhone.
const viewport = mobile
  ? { width: 390, height: 844 }
  : { width: 1280, height: 800 };

// Wiped per run so a stale PNG from a previous change can never be mistaken for
// the current state — the exact failure mode that makes screenshot review
// worthless.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Vercel deployment protection, when it's on, answers a headless request with a
// login page rather than the site — which screenshots as a perfectly clean
// image of the wrong thing. The automation bypass secret turns that off for
// this request. Unset is fine and normal; protection is currently off.
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// --full used to be a lie. Every page on this site scrolls INSIDE an `h-dvh`
// shell — the conversation column, the panel, the document pages all have their
// own overflow-y container — so the document itself never exceeds the viewport
// and Playwright's `fullPage` had nothing to extend past. It produced a
// byte-identical image to a viewport shot, which is the worst kind of broken:
// the flag reported success and the reviewer believed they had seen the page.
//
// So the viewport is GROWN to the content instead. The tallest overflow found
// on the page is added to the viewport height, the page is given a beat to
// reflow, and the measurement is repeated a couple of times in case growing the
// outer scroller revealed more inside an inner one. Capped, because a page with
// a runaway container should produce a big screenshot, not a hung one.
const FULL_MAX_PX = 5000;

/**
 * How much taller this viewport would have to be for nothing to be scrolled
 * out of sight — the largest overflow across the document and every element
 * that actually scrolls.
 */
async function overflowPx(page) {
  return page.evaluate(() => {
    let extra = Math.max(
      0,
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    for (const el of document.querySelectorAll("body *")) {
      if (el.clientHeight <= 0) continue;
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY !== "auto" && overflowY !== "scroll") continue;
      extra = Math.max(extra, el.scrollHeight - el.clientHeight);
    }
    return Math.round(extra);
  });
}

/** Grows the viewport until nothing overflows, or until the cap says stop. */
async function growToContent(page) {
  let height = viewport.height;
  for (let i = 0; i < 3; i += 1) {
    const extra = await overflowPx(page);
    if (extra < 2) break;
    const next = Math.min(FULL_MAX_PX, height + extra);
    if (next <= height) break;
    height = next;
    await page.setViewportSize({ width: viewport.width, height });
    await page.waitForTimeout(250);
  }
  return height;
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport,
  deviceScaleFactor: 2,
  isMobile: mobile,
  hasTouch: mobile,
  colorScheme: "dark",
  extraHTTPHeaders: bypass
    ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" }
    : {},
});

// Console and page errors are collected and printed with the result. Half the
// value of driving a real browser is catching the hydration error that a
// screenshot alone would render as a perfectly innocent-looking page.
const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console: ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

let failed = false;

for (const route of routes) {
  const url = `${BASE}${route.startsWith("/") ? route : `/${route}`}`;
  const name =
    (route.replace(/^\//, "").replace(/\//g, "-") || "home") +
    (mobile ? "-mobile" : "") +
    ".png";
  const file = join(OUT, name);

  try {
    const res = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    if (res && res.status() >= 400) {
      problems.push(`${route}: HTTP ${res.status()}`);
      failed = true;
    }
    // The shell animates in on load. Without a beat here the screenshot catches
    // motion mid-flight and every review turns into a debate about whether the
    // layout is broken or simply still arriving.
    await page.waitForTimeout(600);
    let shotHeight = viewport.height;
    if (fullPage) shotHeight = await growToContent(page);
    await page.screenshot({ path: file, fullPage });
    // The viewport goes back before the next route, so one tall page can't
    // silently change the frame every route after it is shot in.
    if (fullPage && shotHeight !== viewport.height) {
      await page.setViewportSize(viewport);
    }
    console.log(
      `${file}  ←  ${url}${fullPage ? `  (${viewport.width}×${shotHeight})` : ""}`,
    );
  } catch (err) {
    failed = true;
    console.error(`FAILED ${url}: ${err.message}`);
  }
}

await browser.close();

if (problems.length > 0) {
  console.error(`\n${problems.length} browser problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
}

// A screenshot run that silently tolerates a 500 or a pageerror teaches you to
// trust output you shouldn't, so anything that went wrong fails the command.
process.exit(failed || problems.length > 0 ? 1 : 0);
