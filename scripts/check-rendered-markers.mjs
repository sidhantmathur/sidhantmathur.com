// Fails if anything the site serves carries an unfinished-work marker.
//
// Markers are how a draft holds a question for Sidhant — `[TODO: …]` for a
// missing answer, `[VERIFY: …]` for a fact nobody has checked, and the empty
// media frames' "Nothing here yet". They belong in drafts and in
// docs/copy-ledger.md. On 2026-10-19 both council reviewers found them live
// instead: five empty frames and a `[VERIFY]` aside on the flagship case study,
// a `[TODO]` on /colophon, and the FAQ's `[TODO]` published verbatim on
// /prompt. The eval suite checked that every marker was LOGGED; nothing checked
// that none RENDERED. This is that check.
//
// It reads the build output, not the source, because the source is full of
// these strings legitimately — in comments, in the ledger, in the knowledge
// markdown where a held-back question lives. What matters is what a visitor
// can be sent:
//
//   .next/server/app   every prerendered route: its HTML, its RSC payload, and
//                      the body of any prerendered route handler (llms.txt)
//   .next/static       the client bundles, which hold the text client
//                      components render after hydration (panels, manual mode)
//   public             files served as they are
//
// Run as `postbuild`, so a marker fails `npm run build` — and with it a Vercel
// deploy — rather than shipping. evals/static.test.mjs calls the same function
// over whatever build is on disk.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** What a page must never carry. Matched case-insensitively. */
export const MARKERS = ["[TODO", "[VERIFY", "Nothing here yet"];

// A bundle is code as well as text, and code can name a marker without being
// one — manual mode filters chunks on `includes("[TODO")`, which is the guard,
// not a leak. So in a bundle only a COMPLETE marker counts: the bracket, the
// word, and then the colon or the closing bracket every real marker in this
// repo has. Rendered pages and public files get the bare prefixes above.
const BUNDLE_MARKERS = [/\[TODO[:\]]/i, /\[VERIFY[:\]]/i, /Nothing here yet/i];
const PAGE_MARKERS = MARKERS.map((m) => new RegExp(m.replace(/[[\]]/g, "\\$&"), "i"));

const SCAN = [
  { dir: ".next/server/app", ext: [".html", ".rsc", ".body"], patterns: PAGE_MARKERS },
  { dir: ".next/static", ext: [".js"], patterns: BUNDLE_MARKERS },
  { dir: "public", ext: [".txt", ".md", ".html", ".xml", ".json", ".svg"], patterns: PAGE_MARKERS },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

/** True when there is a build to read. */
export function hasBuild(base = root) {
  return existsSync(join(base, ".next", "server", "app"));
}

/**
 * Every marker in the served output, as `{ file, marker, context }`, where
 * `context` is the forty-odd characters either side so a failure says what to
 * go and fix without opening a minified bundle.
 */
export function findRenderedMarkers(base = root) {
  const found = [];
  for (const { dir, ext, patterns } of SCAN) {
    const abs = join(base, dir);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      if (!ext.some((e) => file.endsWith(e))) continue;
      const text = readFileSync(file, "utf8");
      patterns.forEach((pattern, i) => {
        const match = pattern.exec(text);
        if (!match) return;
        found.push({
          file: relative(base, file),
          marker: MARKERS[i],
          context: text.slice(Math.max(0, match.index - 40), match.index + 80).replace(/\s+/g, " "),
        });
      });
    }
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!hasBuild()) {
    console.error("[check-rendered-markers] no build output in .next — run `next build` first.");
    process.exit(1);
  }
  const found = findRenderedMarkers();
  if (found.length) {
    console.error(
      `[check-rendered-markers] ${found.length} unfinished-work marker(s) in the served output. ` +
        "Markers live in drafts and docs/copy-ledger.md, never on a page:",
    );
    for (const f of found) console.error(`  ${f.file}: ${f.marker}  …${f.context}…`);
    process.exit(1);
  }
  console.log("[check-rendered-markers] no [TODO, [VERIFY or empty-frame text in the served output.");
}
