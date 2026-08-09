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
//   node scripts/shot.mjs / --full             # full-page, not just viewport
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

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport,
  deviceScaleFactor: 2,
  isMobile: mobile,
  hasTouch: mobile,
  colorScheme: "dark",
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
    await page.screenshot({ path: file, fullPage });
    console.log(`${file}  ←  ${url}`);
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
