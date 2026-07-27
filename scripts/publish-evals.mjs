// Turns eval runs into the committed snapshot the site publishes (Sprint 6, #2).
//
// The site does NOT publish whatever happened to run on the build machine. It
// publishes this file, which someone deliberately wrote by running the suite and
// then running this. That separation is the whole design: a build server with no
// API key can still deploy the page, and the page can still say when the numbers
// it shows were actually measured, because the measuring and the publishing are
// two events with two timestamps.
//
// Inputs, both optional:
//   evals/static-results.json  — written by `npm run eval` (git-ignored)
//   evals/results.json         — written by `npm run eval:live` (git-ignored)
//
// Output:
//   evals/published/latest.json — COMMITTED. This is the published artifact.
//
// Live runs MERGE by model: publishing a run on one model replaces that model's
// previous entry and leaves the others alone, because a full corpus costs more
// than one hour's rate limit and the models get measured on different days.
// Static results are replaced wholesale — there is only ever one suite.
//
// Usage:
//   npm run eval && npm run eval:publish            # publish the static suite
//   npm run eval:live -- --group grounded
//   npm run eval:publish                            # merge that run in too
//   npm run eval:publish -- --static-only           # ignore evals/results.json

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC_IN = join(ROOT, "evals", "static-results.json");
const LIVE_IN = join(ROOT, "evals", "results.json");
const OUT = join(ROOT, "evals", "published", "latest.json");

const args = process.argv.slice(2);
const staticOnly = args.includes("--static-only");

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`${path} is not valid JSON: ${err.message}`);
  }
}

const existing = readJson(OUT) ?? { static: null, live: { runs: [] } };

// --- the static suite -------------------------------------------------------

function summariseStatic(raw) {
  if (!raw) return null;
  const byFile = new Map();
  for (const t of raw.tests ?? []) {
    const suites = byFile.get(t.file) ?? new Map();
    // A leaf directly under the file has no suite; name that case honestly
    // rather than inventing a group for it.
    const suiteName = t.suite?.length ? t.suite.join(" › ") : "(ungrouped)";
    const suite = suites.get(suiteName) ?? [];
    suite.push({ name: t.name, pass: !!t.pass });
    suites.set(suiteName, suite);
    byFile.set(t.file, suites);
  }

  return {
    ranAt: raw.ranAt ?? null,
    totals: raw.totals ?? null,
    files: [...byFile.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([file, suites]) => ({
        file,
        total: [...suites.values()].reduce((n, s) => n + s.length, 0),
        passed: [...suites.values()].reduce((n, s) => n + s.filter((t) => t.pass).length, 0),
        suites: [...suites.entries()].map(([name, tests]) => ({
          name,
          total: tests.length,
          passed: tests.filter((t) => t.pass).length,
          tests: tests.map((t) => t.name),
        })),
      })),
  };
}

// --- a live run -------------------------------------------------------------

/**
 * Strips a live run down to what can be published.
 *
 * The assistant's prose does NOT travel. Every answer in a run is unreviewed
 * model output making claims about Sidhant, and CLAUDE.md's copy rule does not
 * have an exception for text that arrived via a JSON file. Verdicts, counts and
 * the citation summary are measurements about the run, not claims about him.
 */
function summariseLive(raw, ranAt) {
  const results = raw?.results ?? [];
  if (!results.length) return null;

  const model = raw.model ?? results.find((r) => r.model)?.model ?? "unknown";
  const groups = {};
  for (const r of results) {
    const g = (groups[r.group] ??= { total: 0, passed: 0, broke: 0 });
    g.total += 1;
    if (r.pass) g.passed += 1;
    if (r.broke) g.broke += 1;
  }

  const cited = results.filter((r) => r.citations?.claims);
  const citations = {
    // Answers that contained at least one checkable claim. An answer with
    // nothing checkable in it is not a groundedness data point either way.
    answers: cited.length,
    claims: cited.reduce((n, r) => n + r.citations.claims, 0),
    verified: cited.reduce((n, r) => n + r.citations.verified, 0),
    inventedIds: cited.reduce((n, r) => n + r.citations.unknownIds.length, 0),
  };

  return {
    model,
    ranAt,
    groups,
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    broke: results.filter((r) => r.broke).length,
    citations,
    cases: results.map((r) => ({
      group: r.group,
      id: r.id,
      label: r.label ?? null,
      pass: !!r.pass,
      broke: !!r.broke,
    })),
  };
}

// --- write ------------------------------------------------------------------

const staticRaw = readJson(STATIC_IN);
const nextStatic = summariseStatic(staticRaw) ?? existing.static;

let runs = Array.isArray(existing.live?.runs) ? existing.live.runs : [];
let mergedModel = null;
if (!staticOnly) {
  const liveRaw = readJson(LIVE_IN);
  if (liveRaw) {
    // The runner writes no timestamp of its own, so the file's mtime is the
    // best evidence of when the measurement happened. Recorded as what it is.
    const ranAt = new Date(statSync(LIVE_IN).mtime).toISOString();
    const run = summariseLive(liveRaw, ranAt);
    if (run) {
      runs = [...runs.filter((r) => r.model !== run.model), run].sort((a, b) =>
        a.model.localeCompare(b.model),
      );
      mergedModel = run.model;
    }
  }
}

if (!nextStatic && !runs.length) {
  console.error(
    "Nothing to publish. Run `npm run eval` (and optionally `npm run eval:live`) first.",
  );
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify({ publishedAt: new Date().toISOString(), static: nextStatic, live: { runs } }, null, 2)}\n`,
  "utf8",
);

console.log(`Published evals/published/latest.json`);
if (nextStatic) {
  console.log(`  static: ${nextStatic.totals?.passed}/${nextStatic.totals?.tests} across ${nextStatic.files.length} file(s)`);
}
if (mergedModel) console.log(`  live:   merged run for ${mergedModel}`);
console.log(`  live:   ${runs.length} model(s) on record — ${runs.map((r) => r.model).join(", ") || "none"}`);
console.log(`\nCommit it. The site publishes this file, not the machine it built on.`);
