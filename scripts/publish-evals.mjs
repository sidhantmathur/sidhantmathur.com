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
// Live runs ARCHIVE. Every published run is kept, keyed by model AND run time,
// because a full corpus costs more than one hour's rate limit and the models get
// measured on different days. Publishing a second run on a model that already
// has one adds it; nothing is replaced. Re-publishing the SAME run (same model,
// same start time) is idempotent — it updates that entry in place, so running
// the publisher twice does not double the archive.
//
// It did not always work that way. Until Sprint 8 a run replaced its model's
// previous entry outright, so a second measurement destroyed the first and
// there was no way to see a regression, or to tell a figure measured twice from
// one measured once.
//
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

import { runPerformance, turnPerformance } from "../evals/lib/performance.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Overridable so evals/bakeoff.test.mjs can run this for real against fixtures
// and read what it wrote, without touching the committed artifact. The archive
// rule — a second run on a model KEEPS the first — is the kind of behaviour
// that has to be exercised end to end, because the bug it replaces was a
// one-line filter that looked correct.
const STATIC_IN = process.env.EVALS_STATIC_IN
  ? join(ROOT, process.env.EVALS_STATIC_IN)
  : join(ROOT, "evals", "static-results.json");
const LIVE_IN = process.env.EVALS_LIVE_IN
  ? join(ROOT, process.env.EVALS_LIVE_IN)
  : join(ROOT, "evals", "results.json");
const OUT = process.env.EVALS_PUBLISHED_OUT
  ? join(ROOT, process.env.EVALS_PUBLISHED_OUT)
  : join(ROOT, "evals", "published", "latest.json");

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
 *
 * Timings, token counts and costs travel for the same reason the verdicts do:
 * they are facts about the run, and none of them is a sentence anyone wrote.
 */
function summariseLive(raw, ranAt) {
  const results = raw?.results ?? [];
  if (!results.length) return null;

  // A run where NOTHING was measured is not a result, and must never reach the
  // archive as one. This is not hypothetical: a bake-off whose server was
  // killed halfway through wrote three runs of "0/22 passed", every case a
  // `fetch failed`, and the publisher took them — which would have rendered as
  // three models scoring zero on a page whose whole argument is that its
  // numbers are real. A model that answers badly is a measurement; a model that
  // was never reached is not.
  // A run must have reached the model for MOST of its cases to be a score at
  // all. Both halves of this are things that actually happened while building
  // Sprint 8, on the same afternoon:
  //
  //   * Nothing measured — a bake-off whose server was killed wrote three runs
  //     of "0/22 passed", every case a `fetch failed`, and the publisher took
  //     them. That would have rendered as three models scoring zero.
  //   * Most of it measured — the same server died eight cases into another
  //     model, which published as "13/22 passed" when the model never saw nine
  //     of the questions. That one is worse, because it looks plausible.
  //
  // The threshold is a judgment call and it is deliberately generous: this
  // refuses obvious wreckage, and a run that loses a couple of turns is still
  // publishable with its `broke` count visible beside it.
  const perf = runPerformance(results);
  const reached = perf.turns.measured / results.length;
  if (reached < 0.75) {
    console.error(
      `Refusing to publish this run: only ${perf.turns.measured} of its ${results.length} turn(s)\n` +
        "reached the model. The rest failed in transport, and publishing them as failures would\n" +
        "score the network as if it were the model's judgment. Check the server is up and re-run.",
    );
    return null;
  }

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
    // Sprint 8. Everything the comparison page plots lives under here; the
    // shape above is untouched so Sprint 6's page keeps rendering unchanged.
    performance: perf,
    cases: results.map((r) => ({
      group: r.group,
      id: r.id,
      label: r.label ?? null,
      pass: !!r.pass,
      broke: !!r.broke,
      performance: turnPerformance(r),
    })),
  };
}

/** Identity of a run in the archive: which model, measured when. */
const runKey = (run) => `${run.model}@${run.ranAt ?? "undated"}`;

// --- write ------------------------------------------------------------------

const staticRaw = readJson(STATIC_IN);
const nextStatic = summariseStatic(staticRaw) ?? existing.static;

let runs = Array.isArray(existing.live?.runs) ? existing.live.runs : [];
let merged = null;
let replacedExisting = false;
/** A live run was present and was refused. Exits 2 so a driver can tell. */
let rejectedLive = false;
if (!staticOnly) {
  const liveRaw = readJson(LIVE_IN);
  if (liveRaw) {
    // The runner stamps its own start time now. The file's mtime is kept as the
    // fallback for a results file written before it did — it is the best
    // available evidence, and it is only evidence while nobody has touched the
    // file since, which is why it is no longer the primary.
    const ranAt = liveRaw.startedAt ?? new Date(statSync(LIVE_IN).mtime).toISOString();
    const run = summariseLive(liveRaw, ranAt);
    if (run) {
      // Keyed on model AND time, so a new measurement is added and a
      // re-publish of the same one is idempotent.
      const key = runKey(run);
      replacedExisting = runs.some((r) => runKey(r) === key);
      runs = [...runs.filter((r) => runKey(r) !== key), run].sort(
        (a, b) => a.model.localeCompare(b.model) || String(a.ranAt).localeCompare(String(b.ranAt)),
      );
      merged = run;
    } else {
      rejectedLive = true;
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
if (merged) {
  const cost = merged.performance?.cost;
  console.log(
    `  live:   ${replacedExisting ? "re-published" : "archived"} ${merged.model} ` +
      `(${merged.passed}/${merged.total}${cost ? `, $${cost.totalUsd.toFixed(4)} at list price` : ""})`,
  );
}
const models = [...new Set(runs.map((r) => r.model))];
console.log(
  `  live:   ${runs.length} run(s) on record across ${models.length} model(s) — ${models.join(", ") || "none"}`,
);
console.log(`\nCommit it. The site publishes this file, not the machine it built on.`);

// The static half may still have published fine, so this is not a failure — but
// the caller asked for a live run to go in and it did not, and a driver looping
// over five models must not report that as five published runs.
if (rejectedLive) process.exit(2);
