// Headless screenshots of the site, for reviewing visual changes where there is
// no browser pane, such as a cloud sandbox. Drives Chromium with no display and
// writes PNGs.
//
// Usage:
//   node scripts/shot.mjs                      # / at desktop
//   node scripts/shot.mjs /resume /measurements
//   node scripts/shot.mjs / --mobile
//   node scripts/shot.mjs / --full             # grow the viewport to the content
//   BASE=https://<preview>.vercel.app node scripts/shot.mjs /
//
// Output lands in .screenshots/ (git-ignored; OUT=<dir> to put it elsewhere,
// so two sessions sharing a checkout don't wipe each other's). Requires a
// one-time `npx playwright install chromium` per environment. Exits 1 if any
// route fails to load, returns HTTP 400 or above, or logs a console or page
// error.

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const OUT = process.env.OUT ?? ".screenshots";
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

// Wiped per run so a stale PNG can't be mistaken for the current state.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// With Vercel deployment protection on, a headless request gets a login page,
// which screenshots as a clean image of the wrong thing. The automation bypass
// secret lets the request through; unset is fine when protection is off.
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// Every page scrolls inside an `h-dvh` shell with its own overflow-y
// containers, so the document never exceeds the viewport and Playwright's
// `fullPage` alone captures exactly a viewport shot. --full grows the viewport
// to the content instead, re-measuring in case growing an outer scroller
// revealed more in an inner one. Capped so a runaway container produces a big
// screenshot, not a hung one.
const FULL_MAX_PX = 5000;

/**
 * How much taller the viewport would have to be for nothing to be scrolled out
 * of sight: the largest overflow across the document and every scrolling
 * element.
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

// Console and page errors are collected and fail the run: a hydration error
// can screenshot as an innocent-looking page.
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
    // The shell animates in on load; wait it out so the shot isn't mid-motion.
    await page.waitForTimeout(600);
    let shotHeight = viewport.height;
    if (fullPage) shotHeight = await growToContent(page);
    await page.screenshot({ path: file, fullPage });
    // Reset so one tall page doesn't change the frame for every later route.
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

process.exit(failed || problems.length > 0 ? 1 : 0);
