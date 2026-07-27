// Layer 1 — the published measurements (roadmap Sprint 6: #2, #22, #23).
//
// Two kinds of check here, and the second is the point of the file.
//
// The first is ordinary: the policy in lib/measurements.ts decides what the page
// is allowed to print, and those decisions should be readable and testable
// without a browser.
//
// The second is the one this sprint exists to defend. A panel that invents
// plausible numbers when its source is empty would convert the site's only real
// asset — that its readouts are checkable — into a liability, silently and
// invisibly. So the empty path is run for real here: the build script executes
// with its credentials stripped, and what it writes is read back and asserted
// on. A regression that made the empty state produce a number instead of a
// reason would fail here rather than shipping.
//
// Run: npm run eval

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  MIN_CLAIMS_FOR_RATE,
  MIN_TURNS_FOR_P50,
  MIN_TURNS_FOR_P95,
  formatDate,
  formatMs,
  formatPercent,
  groundedness,
  latencyReadout,
  successRate,
} from "../lib/measurements.ts";
import { ROOT, read } from "./lib/artifacts.mjs";

const PUBLISHED = JSON.parse(read("evals/published/latest.json"));

// --- what the page is allowed to print --------------------------------------

describe("withholding a statistic the sample can't carry", () => {
  const model = (turns) => ({
    model: "test/model",
    turns,
    p50Ms: 400,
    p95Ms: 1200,
    cacheHitRate: 0.9,
  });

  test("a median is withheld below the floor and reported above it", () => {
    assert.equal(latencyReadout(model(MIN_TURNS_FOR_P50 - 1)).p50Ms.value, null);
    assert.equal(latencyReadout(model(MIN_TURNS_FOR_P50 - 1)).p50Ms.reason, "too-few");
    assert.equal(latencyReadout(model(MIN_TURNS_FOR_P50)).p50Ms.value, 400);
  });

  test("a 95th percentile has a stricter floor than a median", () => {
    // The reason it's stricter: the p95 of twenty samples is the second-slowest
    // one. Reporting that in the same type as everything else makes a maximum
    // look like a distribution.
    assert.ok(MIN_TURNS_FOR_P95 > MIN_TURNS_FOR_P50);
    const between = latencyReadout(model(MIN_TURNS_FOR_P50));
    assert.equal(between.p50Ms.value, 400, "the median should be reportable here");
    assert.equal(between.p95Ms.value, null, "the p95 should not");
    assert.equal(latencyReadout(model(MIN_TURNS_FOR_P95)).p95Ms.value, 1200);
  });

  test("a figure that was never measured is distinguished from one that's too thin", () => {
    // Both render as an em dash, and they mean different things. Collapsing
    // them would tell a reader "we have no data" when the truth is "we have
    // some and it isn't enough", or the reverse.
    const unmeasured = latencyReadout({ ...model(500), p50Ms: null, cacheHitRate: null });
    assert.equal(unmeasured.p50Ms.reason, "not-measured");
    assert.equal(unmeasured.cacheHitRate.reason, "not-measured");
    assert.equal(latencyReadout(model(2)).p50Ms.reason, "too-few");
  });

  test("a success rate needs turns before it means anything", () => {
    assert.equal(successRate(0, 0).reason, "not-measured");
    assert.equal(successRate(3, 1).reason, "too-few");
    assert.equal(successRate(99, 1).value, 0.99);
  });
});

describe("groundedness (#22), which is gated on #2 in code", () => {
  const run = (over) => ({
    model: "test/model",
    ranAt: "2026-07-27T00:00:00.000Z",
    groups: { grounded: { total: 6, passed: 6, broke: 0 } },
    passed: 6,
    total: 6,
    broke: 0,
    citations: { answers: 6, claims: 30, verified: 27, inventedIds: 0 },
    cases: [],
    ...over,
  });

  test("no published run means no number at all", () => {
    // This IS the gate. #22 reads the eval snapshot and nothing else, so an
    // unpublished suite can't be dressed up as an unmeasured-but-plausible rate.
    assert.equal(groundedness([]), null);
    assert.equal(
      groundedness([run({ citations: { answers: 0, claims: 0, verified: 0, inventedIds: 0 } })]),
      null,
    );
  });

  test("a rate is withheld under the claim floor and the counts still show", () => {
    const thin = groundedness([
      run({ citations: { answers: 6, claims: 6, verified: 3, inventedIds: 0 } }),
    ]);
    assert.equal(thin.rate.value, null);
    assert.equal(thin.rate.reason, "too-few");
    // 3 of 6 is not "50%" in any sense a reader should carry away, but the pair
    // of counts is still true and still gets published.
    assert.equal(thin.claims, 6);
    assert.equal(thin.verified, 3);
    assert.ok(MIN_CLAIMS_FOR_RATE > 6);
  });

  test("above the floor it reports the rate", () => {
    assert.equal(groundedness([run()]).rate.value, 27 / 30);
  });

  test("a published number drawn only from job-posting runs is caveated", () => {
    // Naming the group is not enough on its own — a reader has no way to know
    // that job-posting turns cite differently from ordinary ones (Sprint 3's
    // finding 4). Without the caveat the counts read as the site's general
    // groundedness, which they are not.
    const jdOnly = groundedness([
      run({ groups: { roleFit: { total: 6, passed: 6, broke: 0 } } }),
    ]);
    assert.ok(!jdOnly.groups.includes("grounded"));
    const page = read("app/measurements/page.tsx");
    assert.match(
      page,
      /!ground\.groups\.includes\("grounded"\)/,
      "the page no longer caveats a groundedness figure drawn only from job-posting runs",
    );
  });

  test("the groups behind the number travel with it", () => {
    // Load-bearing, not decoration: the job-description group cites almost
    // nothing by construction (Sprint 3's finding 4, Sprint 4's out-of-scope
    // note), so a rate drawn from roleFit measures a different thing from one
    // drawn from grounded. A reader who can't see which is being misled.
    const mixed = groundedness([
      run(),
      run({ model: "other/model", groups: { roleFit: { total: 6, passed: 6, broke: 0 } } }),
    ]);
    assert.deepEqual(mixed.groups, ["grounded", "roleFit"]);
    assert.deepEqual(mixed.models, ["test/model", "other/model"]);
  });
});

describe("formatting", () => {
  test("milliseconds stay milliseconds until they're seconds", () => {
    assert.equal(formatMs(420), "420 ms");
    assert.equal(formatMs(1500), "1.50 s");
  });

  test("a percentage keeps a decimal unless it would read as false precision", () => {
    assert.equal(formatPercent(0.9), "90.0%");
    assert.equal(formatPercent(1), "100%");
    assert.equal(formatPercent(0), "0%");
  });

  test("an undated thing says so rather than showing an epoch", () => {
    assert.equal(formatDate(null), "date unknown");
    assert.equal(formatDate("not a date"), "date unknown");
    assert.equal(formatDate("2026-07-27T20:00:00.000Z"), "27 Jul 2026");
  });
});

// --- the empty state, run for real ------------------------------------------

describe("the build with nothing to show", () => {
  /** Runs scripts/build-measurements.mjs into a temp file and returns the source. */
  function buildInto(env) {
    const dir = mkdtempSync(join(tmpdir(), "measurements-"));
    const out = join(dir, "out.ts");
    try {
      execFileSync(process.execPath, [join(ROOT, "scripts", "build-measurements.mjs")], {
        cwd: ROOT,
        stdio: "pipe",
        env: {
          ...process.env,
          POSTHOG_PROJECT_ID: "",
          POSTHOG_PERSONAL_API_KEY: "",
          MEASUREMENTS_OUT: relative(ROOT, out),
          ...env,
        },
      });
      return readFileSync(out, "utf8");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test("a build with no analytics credentials succeeds and says so", () => {
    // The acceptance criterion this sprint is most likely to regress on: a
    // deploy without a key must still deploy, and the panel must name what is
    // missing rather than showing anything.
    const src = buildInto({});
    assert.match(src, /"available": false/);
    assert.match(src, /"reason": "no-credentials"/);
  });

  test("the empty state carries no numbers for the panel to render", () => {
    const src = buildInto({});
    const analytics = JSON.parse(
      src.slice(src.indexOf("export const ANALYTICS: Analytics = ") + 35).replace(/;\s*$/, ""),
    );
    assert.equal(analytics.available, false);
    // No turns, no models, no percentiles — nothing a renderer could mistake
    // for a measurement.
    for (const key of ["models", "byClass", "completedTurns", "failedTurns", "windowDays"]) {
      assert.equal(analytics[key], undefined, `the empty state leaked a "${key}"`);
    }
  });

  test("the script never invents a fallback number", () => {
    // Belt and braces around the test above: the fixture cases in a future edit
    // could easily become "reasonable defaults". These are the words that would
    // mean it happened.
    const src = read("scripts/build-measurements.mjs");
    for (const forbidden of ["SAMPLE_", "PLACEHOLDER", "FALLBACK_LATENCY", "DEFAULT_P50"]) {
      assert.ok(!src.includes(forbidden), `build-measurements.mjs mentions ${forbidden}`);
    }
  });

  test("every reason the aggregate can be unavailable has a sentence on the page", () => {
    // Otherwise a new reason renders as a blank section, which reads as "there
    // is nothing wrong" — the exact confusion the empty states exist to avoid.
    const types = read("lib/measurement-types.ts");
    const union = types.slice(types.indexOf('reason: "no-credentials"'));
    const reasons = [...union.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]).slice(0, 3);
    const page = read("app/measurements/page.tsx");
    for (const reason of reasons) {
      assert.ok(
        page.includes(`"${reason}"`),
        `app/measurements/page.tsx has no branch for the "${reason}" reason`,
      );
    }
    assert.deepEqual(reasons, ["no-credentials", "no-events", "query-failed"]);
  });
});

// --- the published snapshot -------------------------------------------------

describe("the published eval snapshot", () => {
  test("is committed and parses", () => {
    assert.ok(PUBLISHED.publishedAt, "the snapshot has no publish date");
    assert.ok(PUBLISHED.static || PUBLISHED.live.runs.length, "the snapshot is empty");
  });

  test("carries no model prose", () => {
    // The copy rule (CLAUDE.md) has no exception for text that arrived through
    // a JSON file. Every answer in a live run is unreviewed model output making
    // claims about Sidhant; publishing it because it was convenient to carry
    // would be shipping unlogged copy. Verdicts and counts are measurements
    // about the run, not claims about him, so those travel.
    const raw = read("evals/published/latest.json");
    assert.ok(!raw.includes('"answer"'), "the snapshot carries a model answer");
    assert.ok(!raw.includes('"evidence"'), "the snapshot carries assessment prose");
    assert.ok(!raw.includes('"failures"'), "the snapshot carries failure detail");
  });

  test("the static half matches the suite that is actually here", () => {
    // Catches a snapshot that was published once and then rotted: a test file
    // that was deleted or renamed leaves a section on the page describing
    // assertions nobody runs any more.
    if (!PUBLISHED.static) return;
    for (const file of PUBLISHED.static.files) {
      assert.doesNotThrow(
        () => read(file.file),
        `the snapshot publishes ${file.file}, which no longer exists — re-run npm run eval && npm run eval:publish`,
      );
    }
  });

  test("every published live run names its model and its groups", () => {
    for (const run of PUBLISHED.live.runs) {
      assert.ok(run.model && run.model !== "unknown", "a published run has no model");
      assert.ok(Object.keys(run.groups).length, `run ${run.model} names no groups`);
      assert.ok(run.total > 0, `run ${run.model} has no cases`);
    }
  });
});

describe("the machine-readable eval output", () => {
  test("npm run eval still prints TAP as well as writing JSON", () => {
    // #2 needed a machine-readable layer; it must not have cost the human one.
    const pkg = JSON.parse(read("package.json"));
    assert.match(pkg.scripts.eval, /--test-reporter=tap/);
    assert.match(pkg.scripts.eval, /--test-reporter-destination=stdout/);
    assert.match(pkg.scripts.eval, /reporters\/json\.mjs/);
    assert.match(pkg.scripts.eval, /evals\/static-results\.json/);
  });

  test("the measurements build runs before every build and every dev server", () => {
    const pkg = JSON.parse(read("package.json"));
    for (const hook of ["prebuild", "predev"]) {
      assert.match(
        pkg.scripts[hook],
        /build-measurements\.mjs/,
        `${hook} doesn't build the measurements — the page would render a stale module`,
      );
    }
  });

  test("the published snapshot is committed, not ignored", () => {
    // The whole design rests on this file being in the repo: the site publishes
    // the snapshot, not whatever the build machine happened to measure.
    // Rules only — the file also mentions the path in a comment explaining why
    // it is NOT ignored, and matching that would be the test failing on its own
    // documentation.
    const rules = read(".gitignore")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    assert.ok(
      !rules.some((rule) => rule.includes("evals/published")),
      "the published snapshot is git-ignored — the site would ship with nothing to publish",
    );
    assert.ok(
      rules.includes("evals/static-results.json"),
      "the raw run output should be ignored; only the published snapshot is committed",
    );
  });
});
