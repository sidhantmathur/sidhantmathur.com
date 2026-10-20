// Static assertions for the model bake-off (Sprint 8).
//
// Three things get tested here, and they are the three that would fail silently:
//
//   1. THE ARCHIVE KEEPS BOTH RUNS. This replaced a one-line filter that looked
//      correct and quietly destroyed the previous measurement of a model. It is
//      exercised by running the real publisher against fixtures, because the
//      bug was in the publisher, not in a helper it calls.
//   2. A MISSING MEASUREMENT IS NULL, NEVER ZERO. A turn with no telemetry that
//      averaged in as 0 ms would make a broken run the fastest model on the
//      page — the worst failure this site could publish about itself.
//   3. THE FRONTIER IS ARITHMETIC. It decides which models get the accent, so
//      it is the one piece of the page that expresses an opinion, and it should
//      be provably the opinion "nothing beats this on both axes".

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

import { runPerformance, sample, turnPerformance } from "./lib/performance.mjs";
import { ROOT } from "./lib/artifacts.mjs";
import { MIN_TURNS_FOR_P50 } from "../lib/measurements.ts";
import { MODEL_PRICES, PRICE_CONFIDENCE } from "../lib/pricing.ts";
import {
  allGroups,
  bakeoffSummary,
  catalogueDrift,
  formatTurnCost,
  frontier,
  latestRunPerModel,
  measuredRange,
  median,
  placeLabels,
  rank,
  runHistory,
  splitArchive,
  supportsMedian,
  toRow,
} from "../lib/model-comparison.ts";

// --- fixtures ---------------------------------------------------------------

const turn = (over = {}) => ({
  group: "grounded",
  id: "case",
  pass: true,
  broke: null,
  telemetry: {
    model: "openai/gpt-5-mini",
    usage: {
      inputTokens: 6000,
      cachedInputTokens: 5800,
      cacheWriteTokens: 0,
      outputTokens: 300,
      totalTokens: 6300,
    },
    timing: { ttftMs: 1200, durationMs: 3000, tokensPerSecond: 80 },
    steps: 1,
    finishReason: "stop",
    ...over,
  },
});

const run = (over = {}) => ({
  model: "openai/gpt-5-mini",
  ranAt: "2026-07-27T12:00:00.000Z",
  groups: { grounded: { total: 2, passed: 2, broke: 0 } },
  passed: 2,
  total: 2,
  broke: 0,
  citations: { answers: 2, claims: 4, verified: 3, inventedIds: 0 },
  cases: [],
  ...over,
});

// --- 1. the archive ---------------------------------------------------------

describe("publishing archives runs instead of replacing them", () => {
  const dir = mkdtempSync(join(tmpdir(), "bakeoff-"));
  const rel = (name) => relative(ROOT, join(dir, name));

  const publish = (liveFile) =>
    execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "scripts/publish-evals.mjs"],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          EVALS_LIVE_IN: rel(liveFile),
          EVALS_PUBLISHED_OUT: rel("published.json"),
          // Nothing static in play — this is only about the live archive.
          EVALS_STATIC_IN: rel("absent.json"),
        },
      },
    );

  const liveFile = (name, startedAt) => {
    writeFileSync(
      join(dir, name),
      JSON.stringify({
        model: "openai/gpt-5-mini",
        startedAt,
        results: [turn(), turn({ finishReason: "length" })],
      }),
    );
    return name;
  };

  it("keeps an earlier run on the same model", () => {
    publish(liveFile("first.json", "2026-07-01T10:00:00.000Z"));
    publish(liveFile("second.json", "2026-07-20T10:00:00.000Z"));

    const out = JSON.parse(readFileSync(join(dir, "published.json"), "utf8"));
    const dates = out.live.runs.map((r) => r.ranAt);
    assert.equal(out.live.runs.length, 2, "a second run must not replace the first");
    assert.deepEqual(dates, ["2026-07-01T10:00:00.000Z", "2026-07-20T10:00:00.000Z"]);
  });

  it("is idempotent — re-publishing the same run does not duplicate it", () => {
    publish(liveFile("third.json", "2026-07-20T10:00:00.000Z"));
    const out = JSON.parse(readFileSync(join(dir, "published.json"), "utf8"));
    assert.equal(out.live.runs.length, 2, "same model at the same time is the same run");
    rmSync(dir, { recursive: true, force: true });
  });

  it("refuses a run where most turns never reached the model", () => {
    const d3 = mkdtempSync(join(tmpdir(), "bakeoff-wreck-"));
    // Four turns attempted, one measured: the shape of a server that went away
    // mid-run. Publishing it would score three transport failures as the model
    // answering badly.
    writeFileSync(
      join(d3, "live.json"),
      JSON.stringify({
        startedAt: "2026-07-27T09:00:00.000Z",
        results: [
          turn(),
          { group: "g", id: "a", pass: false, broke: "fetch failed" },
          { group: "g", id: "b", pass: false, broke: "fetch failed" },
          { group: "g", id: "c", pass: false, broke: "fetch failed" },
        ],
      }),
    );
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "scripts/publish-evals.mjs"],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          EVALS_LIVE_IN: relative(ROOT, join(d3, "live.json")),
          EVALS_PUBLISHED_OUT: relative(ROOT, join(d3, "out.json")),
          EVALS_STATIC_IN: relative(ROOT, join(d3, "absent.json")),
        },
      },
    );
    assert.match(result.stderr, /Refusing to publish/);
    assert.equal(existsSync(join(d3, "out.json")), false, "nothing is written at all");
    rmSync(d3, { recursive: true, force: true });
  });

  it("publishes a performance record with each archived run", () => {
    const d2 = mkdtempSync(join(tmpdir(), "bakeoff-perf-"));
    writeFileSync(
      join(d2, "live.json"),
      JSON.stringify({ startedAt: "2026-07-27T09:00:00.000Z", results: [turn(), turn()] }),
    );
    execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "scripts/publish-evals.mjs"],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          EVALS_LIVE_IN: relative(ROOT, join(d2, "live.json")),
          EVALS_PUBLISHED_OUT: relative(ROOT, join(d2, "out.json")),
          EVALS_STATIC_IN: relative(ROOT, join(d2, "absent.json")),
        },
      },
    );
    const out = JSON.parse(readFileSync(join(d2, "out.json"), "utf8"));
    const perf = out.live.runs[0].performance;
    assert.ok(perf, "every published run carries a performance record");
    assert.equal(perf.ttftMs.p50, 1200);
    assert.ok(perf.cost.totalUsd > 0, "a priced model publishes a cost");
    assert.ok(out.live.runs[0].cases[0].performance, "and per-turn performance on each case");
    rmSync(d2, { recursive: true, force: true });
  });
});

describe("publishing the citation verdicts", () => {
  const publishCitations = (results) => {
    const d = mkdtempSync(join(tmpdir(), "bakeoff-verdicts-"));
    writeFileSync(join(d, "live.json"), JSON.stringify({ startedAt: "2026-10-20T02:00:00.000Z", results }));
    execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "scripts/publish-evals.mjs"],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          EVALS_LIVE_IN: relative(ROOT, join(d, "live.json")),
          EVALS_PUBLISHED_OUT: relative(ROOT, join(d, "out.json")),
          EVALS_STATIC_IN: relative(ROOT, join(d, "absent.json")),
        },
      },
    );
    const out = JSON.parse(readFileSync(join(d, "out.json"), "utf8"));
    rmSync(d, { recursive: true, force: true });
    return out.live.runs[0].citations;
  };
  const cited = (verdicts) => ({
    ...turn(),
    citations: { claims: 4, verified: 1, unknownIds: [], ...(verdicts ? { verdicts } : {}) },
  });

  it("sums each verdict across the run's answers", () => {
    const c = publishCitations([
      cited({ verified: 1, miscited: 2, unverified: 1, uncited: 0 }),
      cited({ verified: 1, miscited: 0, unverified: 0, uncited: 3 }),
    ]);
    assert.deepEqual(c.verdicts, { verified: 2, miscited: 2, unverified: 1, uncited: 3 });
    assert.equal(c.claims, 8, "and the split adds up to the claims");
  });

  it("publishes no split when any answer lacks one", () => {
    const c = publishCitations([cited({ verified: 1, miscited: 2, unverified: 1, uncited: 0 }), cited(null)]);
    assert.equal(c.verdicts, undefined);
    assert.equal(c.claims, 8, "the totals still publish");
  });
});

// --- 2. a missing measurement is null, never zero ---------------------------

describe("performance aggregation never invents a measurement", () => {
  it("returns null for an empty sample rather than 0", () => {
    assert.equal(sample([]), null);
    assert.equal(sample([null, undefined, NaN]), null);
  });

  it("excludes a turn with no telemetry instead of counting it as instant", () => {
    const perf = runPerformance([turn(), { group: "g", id: "broke", broke: "stream error" }]);
    assert.equal(perf.turns.measured, 1);
    assert.equal(perf.turns.missing, 1);
    assert.equal(perf.ttftMs.n, 1, "the broken turn contributes no timing");
    assert.equal(perf.ttftMs.min, 1200, "and cannot drag the minimum to zero");
  });

  it("drops a single missing TTFT without dropping the whole turn", () => {
    const perf = runPerformance([turn(), turn({ timing: { ttftMs: null, durationMs: 900, tokensPerSecond: 60 } })]);
    assert.equal(perf.turns.measured, 2);
    assert.equal(perf.ttftMs.n, 1, "only the measured TTFT counts");
    assert.equal(perf.durationMs.n, 2, "but the turn's other timings still do");
  });

  it("prices an unpriced model as null, not as free", () => {
    const perf = runPerformance([turn({ model: "someone/unlisted-model" })]);
    assert.equal(perf.cost, null, "no price on record means no cost figure");
    assert.equal(turnPerformance(turn({ model: "someone/unlisted-model" })).costUsd, null);
  });

  it("measures cache hit rate over input tokens, not over turns", () => {
    // One fully-cached turn and one cold turn. Over TURNS that would read 50%;
    // over TOKENS it is what the bill actually reflects.
    const perf = runPerformance([
      turn({ usage: { inputTokens: 6000, cachedInputTokens: 6000, cacheWriteTokens: 0, outputTokens: 100, totalTokens: 6100 } }),
      turn({ usage: { inputTokens: 6000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 100, totalTokens: 6100 } }),
    ]);
    assert.equal(perf.cacheHitRate, 0.5);
  });

  it("costs a turn at the same list prices the per-turn meter uses", () => {
    const perf = turnPerformance(turn());
    const price = MODEL_PRICES["openai/gpt-5-mini"];
    const expected =
      ((6000 - 5800) / 1e6) * price.input + (5800 / 1e6) * price.cacheRead + (300 / 1e6) * price.output;
    assert.ok(Math.abs(perf.costUsd - expected) < 1e-12);
  });
});

// --- 3. the page's derivations ---------------------------------------------

describe("what the comparison page derives", () => {
  it("shows the most recent run per model and never counts one twice", () => {
    const runs = [
      run({ ranAt: "2026-07-01T00:00:00.000Z", passed: 1 }),
      run({ ranAt: "2026-07-20T00:00:00.000Z", passed: 2 }),
      run({ model: "anthropic/claude-haiku-4.5" }),
    ];
    const latest = latestRunPerModel(runs);
    assert.equal(latest.length, 2, "one row per model");
    assert.equal(latest.find((r) => r.model === "openai/gpt-5-mini").ranAt, "2026-07-20T00:00:00.000Z");
  });

  it("scores a model on what it answered, not on what broke in transport", () => {
    // The measured shape of deepseek-v4-flash: 15 passed of 22 attempted, with
    // 6 that died mid-stream. Over attempted that is 68% and puts it near the
    // bottom of the quality axis; over ANSWERED it is 15 of 16, and the
    // reliability problem is reported separately instead of being smuggled
    // into the pass rate.
    const row = toRow(
      run({
        total: 22,
        passed: 15,
        broke: 6,
        groups: { grounded: { total: 6, passed: 3, broke: 3 } },
      }),
    );
    assert.equal(row.answered, 16);
    assert.equal(row.passRate, 15 / 16);
    assert.equal(row.breakRate, 6 / 22);
    assert.equal(row.groups[0].rate, 1, "a group's rate uses the same denominator");
  });

  it("lists every run in the archive, newest first", () => {
    const history = runHistory([
      run({ ranAt: "2026-07-01T00:00:00.000Z" }),
      run({ ranAt: "2026-07-20T00:00:00.000Z" }),
    ]);
    assert.equal(history.length, 1);
    assert.deepEqual(
      history[0].runs.map((r) => r.ranAt),
      ["2026-07-20T00:00:00.000Z", "2026-07-01T00:00:00.000Z"],
    );
  });

  it("names a replaced model as no longer offered instead of handing its runs to the successor", () => {
    // The 2026-10-19 refresh, in miniature: haiku 4.5 was measured and then
    // replaced by 5.5, which never was. The old figures stay 4.5's; the page
    // names both sides of the gap rather than letting one id stand for the other.
    const drift = catalogueDrift(
      ["anthropic/claude-haiku-4.5", "openai/gpt-5-mini"],
      ["openai/gpt-5-mini", "anthropic/claude-haiku-5.5"],
    );
    assert.deepEqual(drift.noLongerOffered, ["anthropic/claude-haiku-4.5"]);
    assert.deepEqual(drift.notMeasured, ["anthropic/claude-haiku-5.5"]);
  });

  it("charts only the models on offer, and keeps a retired model's runs as history", () => {
    // The 2026-10-19 refresh: the archive held July runs of three models the
    // chat then dropped. Read as "latest per model", they sat in the charts
    // beside October's runs under a sentence saying it was one afternoon.
    const offered = ["openai/gpt-6-luna", "openai/gpt-5-mini"];
    const july = run({ ranAt: "2026-07-27T00:00:00.000Z" });
    const october = run({ ranAt: "2026-10-20T02:00:00.000Z" });
    const retiredRun = run({ model: "openai/gpt-5.6-luna", ranAt: "2026-07-27T00:00:00.000Z" });
    const luna1 = run({ model: "openai/gpt-6-luna", ranAt: "2026-10-20T01:00:00.000Z" });
    const luna2 = run({ model: "openai/gpt-6-luna", ranAt: "2026-10-20T03:00:00.000Z" });

    const split = splitArchive([july, retiredRun, october, luna1, luna2], offered);
    assert.deepEqual(
      split.current.map((r) => `${r.model}@${r.ranAt}`),
      ["openai/gpt-6-luna@2026-10-20T03:00:00.000Z", "openai/gpt-5-mini@2026-10-20T02:00:00.000Z"],
      "the latest run of each offered model, in catalogue order",
    );
    assert.deepEqual(split.retired, ["openai/gpt-5.6-luna"]);
    assert.equal(split.earlier.length, 3, "every run not charted is still on the record");
    assert.ok(split.earlier.includes(retiredRun));
    assert.ok(!split.current.some((r) => r.model === "openai/gpt-5.6-luna"), "a retired run is never charted");
  });

  it("never charts a retired model, even when its run is the newest", () => {
    const split = splitArchive(
      [run({ model: "anthropic/claude-haiku-4.5", ranAt: "2026-12-01T00:00:00.000Z" })],
      ["anthropic/claude-haiku-5.5"],
    );
    assert.equal(split.current.length, 0);
    assert.deepEqual(split.retired, ["anthropic/claude-haiku-4.5"]);
  });

  it("finds no gap when the catalogue is what was measured", () => {
    const drift = catalogueDrift(["a/x", "b/y"], ["b/y", "a/x"]);
    assert.deepEqual(drift, { noLongerOffered: [], notMeasured: [] });
  });

  it("moves a scatter label off a neighbouring dot instead of printing through it", () => {
    // The 2026-10-20 cost frontier: gpt-6-luna's label, placed to the right as
    // every label was, ran through deepseek-v4-flash-0731's dot 40px away.
    const dots = [
      { x: 150, y: 110, text: "gpt-6-luna" },
      { x: 190, y: 113, text: "deepseek-v4-flash-0731" },
    ];
    const spots = placeLabels(dots, { x0: 72, x1: 560 });
    const box = (d, s) => {
      const w = d.text.length * 6;
      const x0 = s.anchor === "start" ? s.x : s.anchor === "end" ? s.x - w : s.x - w / 2;
      return { x0, x1: x0 + w, y0: s.y - 9.5, y1: s.y + 1.5 };
    };
    const hits = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const [luna, deepseek] = spots.map((s, i) => box(dots[i], s));
    const deepseekDot = { x0: 184, x1: 196, y0: 107, y1: 119 };
    assert.ok(!hits(luna, deepseekDot), "the first label still crosses the second dot");
    assert.ok(!hits(luna, deepseek), "the two labels overlap");
  });

  it("keeps a lone label to the right, and flips it near the right edge", () => {
    assert.equal(placeLabels([{ x: 200, y: 100, text: "gpt-5-mini" }], { x0: 72, x1: 560 })[0].anchor, "start");
    assert.equal(placeLabels([{ x: 520, y: 100, text: "gpt-5-mini" }], { x0: 72, x1: 560 })[0].anchor, "end");
  });

  it("puts a model on the frontier only when nothing beats it on both axes", () => {
    const rows = [
      // cheap and good — must be on it
      toRow(run({ model: "a/cheap-good", passed: 2, total: 2, performance: perfWithCost(0.001) })),
      // dearer and worse — must not be
      toRow(run({ model: "a/dear-bad", passed: 1, total: 2, performance: perfWithCost(0.01) })),
      // dearest but best — a different trade, so it stays on it
      toRow(run({ model: "a/dear-best", passed: 2, total: 2, performance: perfWithCost(0.02) })),
    ];
    const { points } = frontier(rows, (r) => r.costPerTaskUsd, (r) => r.passRate);
    const on = points.filter((p) => p.onFrontier).map((p) => p.row.model);
    assert.deepEqual(on.sort(), ["a/cheap-good"], "a dearer model at the same quality is beaten");
  });

  it("does not plot a model that is missing an axis, and reports it", () => {
    const rows = [
      toRow(run({ model: "a/priced", performance: perfWithCost(0.001) })),
      toRow(run({ model: "a/unpriced" })),
    ];
    const { points, unplotted } = frontier(rows, (r) => r.costPerTaskUsd, (r) => r.passRate);
    assert.equal(points.length, 1);
    assert.deepEqual(unplotted.map((r) => r.model), ["a/unpriced"]);
  });

  it("ranks best-first and emphasises exactly one bar", () => {
    const rows = [
      toRow(run({ model: "a/slow", performance: perfWithTtft(4000) })),
      toRow(run({ model: "a/fast", performance: perfWithTtft(1000) })),
    ];
    const { bars } = rank(rows, (r) => r.ttftMs.p50, "lower");
    assert.deepEqual(bars.map((b) => b.row.model), ["a/fast", "a/slow"]);
    assert.equal(bars.filter((b) => b.best).length, 1);
    assert.equal(bars[0].best, true);
    // Length encodes magnitude against the panel maximum, whichever direction
    // is "better" — so a 4s bar stays four times a 1s bar.
    assert.equal(bars[0].fraction, 0.25);
    assert.equal(bars[1].fraction, 1);
  });

  it("emphasises nothing on a metric with no better direction", () => {
    const rows = [
      toRow(run({ model: "a/terse", performance: perfWithTtft(1000) })),
      toRow(run({ model: "a/verbose", performance: perfWithTtft(4000) })),
    ];
    const { bars } = rank(rows, (r) => r.ttftMs.p50, "none");
    assert.equal(bars.filter((b) => b.best).length, 0, "no accent where the data has no preference");
    assert.equal(bars.length, 2, "but every model is still plotted");
  });

  it("emphasises nothing when models tie for best", () => {
    // Four models broke on zero turns and one did not. Painting four of five
    // bars with the accent points at nothing and buries the only difference.
    const rows = ["a", "b", "c"].map((id) =>
      toRow(run({ model: `a/${id}`, total: 10, passed: 10, broke: 0 })),
    );
    rows.push(toRow(run({ model: "a/flaky", total: 10, passed: 7, broke: 3 })));
    const { bars } = rank(rows, (r) => r.breakRate, "lower");
    assert.equal(bars.filter((b) => b.best).length, 0, "a three-way tie is not a winner");
    assert.equal(bars.at(-1).row.model, "a/flaky", "the outlier still sorts last");
  });

  it("withholds a median the sample cannot support", () => {
    assert.equal(supportsMedian(null), false);
    assert.equal(supportsMedian({ n: 3, p50: 1, min: 1, max: 1 }), false);
    assert.equal(supportsMedian({ n: 22, p50: 1, min: 1, max: 1 }), true);
  });

  it("collects every group across models for the scorecard", () => {
    const rows = [
      toRow(run({ groups: { grounded: { total: 1, passed: 1, broke: 0 } } })),
      toRow(run({ model: "a/other", groups: { injection: { total: 1, passed: 0, broke: 0 } } })),
    ];
    assert.deepEqual(allGroups(rows), ["grounded", "injection"]);
  });

  it("reads a median only through the gate", () => {
    // The accessor is the gate. A p50 read straight off a three-turn sample is
    // a number with a median's typography and a maximum's information, and it
    // would render in the same type as one over twenty-two turns.
    assert.equal(median(null), null, "an unmeasured sample has no median");
    assert.equal(median({ n: 3, p50: 900, min: 900, max: 900 }), null, "and nor does a thin one");
    assert.equal(median({ n: 22, p50: 900, min: 800, max: 1000 }), 900);
  });

  it("holds a token median to the same floor as a timing median", () => {
    // The token panels and the table's `in`/`out` columns used to read `.p50`
    // straight off the sample while the timing panels went through the gate.
    // A six-turn run therefore printed an em dash for its median TTFT and a
    // real median token count in the same row, from the same six turns.
    const thin = toRow(run({ model: "a/thin", performance: perfWithTurns(MIN_TURNS_FOR_P50 - 1) }));
    assert.equal(median(thin.ttftMs), null);
    assert.equal(median(thin.tokensPerSecond), null);
    assert.equal(median(thin.inputTokens), null, "a token count is not exempt from the floor");
    assert.equal(median(thin.outputTokens), null);

    const { bars, missing } = rank([thin], (r) => median(r.outputTokens), "none");
    assert.equal(bars.length, 0, "and a withheld median is not plotted");
    assert.deepEqual(missing.map((r) => r.model), ["a/thin"], "it is reported as missing instead");

    const atFloor = toRow(run({ model: "a/floor", performance: perfWithTurns(MIN_TURNS_FOR_P50) }));
    assert.equal(median(atFloor.ttftMs), 1200);
    assert.equal(median(atFloor.tokensPerSecond), 80);
    assert.equal(median(atFloor.inputTokens), 6000, "exactly at the floor is enough");
    assert.equal(median(atFloor.outputTokens), 300);
  });
});

// --- the figures above the charts -------------------------------------------

describe("what the whole bake-off adds up to", () => {
  const priced = (over) => run({ performance: perfWithCost(0.001), ...over });

  it("counts turns and breaks across every compared run", () => {
    const rows = [
      toRow(run({ model: "a/one", total: 22, passed: 20, broke: 2 })),
      toRow(run({ model: "a/two", total: 22, passed: 22, broke: 0 })),
    ];
    const summary = bakeoffSummary(rows);
    assert.equal(summary.turnsGraded, 44);
    assert.equal(summary.turnsBroke, 2);
  });

  it("says the corpus is the same one only when it is", () => {
    const same = bakeoffSummary([
      toRow(run({ model: "a/one", total: 22, passed: 22 })),
      toRow(run({ model: "a/two", total: 22, passed: 22 })),
    ]);
    assert.equal(same.uniformCorpus, true);
    assert.equal(same.casesEach, 22);

    // The page prints "varies" off this. Two models measured on different
    // numbers of cases are not being compared on the same corpus, and a
    // headline "22 cases each" over a run of 12 would be a false claim about
    // the measurement rather than a rounding.
    const mixed = bakeoffSummary([
      toRow(run({ model: "a/one", total: 22, passed: 22 })),
      toRow(run({ model: "a/two", total: 12, passed: 12 })),
    ]);
    assert.equal(mixed.uniformCorpus, false);
  });

  it("totals the cost of the comparison", () => {
    const summary = bakeoffSummary([
      toRow(priced({ model: "a/one" })),
      toRow(priced({ model: "a/two" })),
    ]);
    assert.equal(summary.totalCost, 0.001 * 22 * 2);
  });

  it("has no total at all when one model's cost is unknown", () => {
    // NOT a partial sum. One unpriced model is exactly the live case — one
    // model's rates could not be confirmed — and a total over the other four
    // would print as "the cost of the whole comparison" while being the cost
    // of most of it. Cheaper than the truth, in the site's own headline figure.
    const summary = bakeoffSummary([
      toRow(priced({ model: "a/priced" })),
      toRow(run({ model: "a/unpriced" })),
      toRow(priced({ model: "a/also-priced" })),
    ]);
    assert.equal(summary.totalCost, null);
  });

  it("dates the artifact, and says so as a span when it was not one sitting", () => {
    const oneDay = bakeoffSummary([
      toRow(run({ model: "a/one", ranAt: "2026-07-27T19:10:00.000Z" })),
      toRow(run({ model: "a/two", ranAt: "2026-07-27T21:03:00.000Z" })),
    ]);
    assert.deepEqual(oneDay.measuredOn, [
      "2026-07-27T19:10:00.000Z",
      "2026-07-27T21:03:00.000Z",
    ]);
    assert.equal(oneDay.measuredRange, "27 Jul 2026", "one afternoon reads as a date");

    const spread = bakeoffSummary([
      toRow(run({ model: "a/late", ranAt: "2026-07-31T20:54:00.000Z" })),
      toRow(run({ model: "a/early", ranAt: "2026-07-27T19:10:00.000Z" })),
    ]);
    assert.equal(spread.measuredRange, "27 Jul 2026 to 31 Jul 2026", "earliest first, both ends");
  });

  it("keeps an undated run out of the span rather than dating it", () => {
    const summary = bakeoffSummary([
      toRow(run({ model: "a/dated", ranAt: "2026-07-27T19:10:00.000Z" })),
      toRow(run({ model: "a/undated", ranAt: null })),
    ]);
    assert.deepEqual(summary.measuredOn, ["2026-07-27T19:10:00.000Z"]);
    assert.equal(summary.measuredRange, "27 Jul 2026");
    assert.equal(measuredRange([]), "on an unknown date", "and nothing dated says so");
  });
});

// --- what a turn costs, printed at the scale it costs -----------------------

describe("cost precision follows the cost", () => {
  it("spends a fifth decimal only where four would read as free", () => {
    // The boundary is exact: at a tenth of a cent four decimals still say
    // something, below it they say $0.0000.
    assert.equal(formatTurnCost(0.001), "$0.0010");
    assert.equal(formatTurnCost(0.00099), "$0.00099");
    assert.equal(formatTurnCost(0.0025391), "$0.0025");
  });

  it("prints an em dash rather than a cost for an unpriced turn", () => {
    assert.equal(formatTurnCost(null), "—");
  });
});

// --- the price caveat has to travel with the price -------------------------

describe("published prices carry their confidence", () => {
  it("names a confidence for every priced model", () => {
    for (const model of Object.keys(MODEL_PRICES)) {
      assert.ok(
        PRICE_CONFIDENCE[model],
        `${model} has a price but no confidence — the page would print a dollar figure with no caveat`,
      );
    }
  });
});

// Helpers that build only the part of a performance record a test needs.
function perfWithCost(perTurnP50Usd) {
  return {
    turns: { measured: 22, missing: 0 },
    ttftMs: null,
    durationMs: null,
    tokensPerSecond: null,
    inputTokens: null,
    outputTokens: null,
    cachedInputTokens: null,
    steps: null,
    cacheHitRate: null,
    finishReasons: {},
    cost: { pricedTurns: 22, totalUsd: perTurnP50Usd * 22, perTurnP50Usd, savedUsd: 0 },
  };
}

function perfWithTtft(p50) {
  return {
    ...perfWithCost(0.001),
    ttftMs: { n: 22, p50, min: p50, max: p50 },
  };
}

/** A run measured over `n` turns, with every sample the page reads populated. */
function perfWithTurns(n) {
  const s = (p50) => ({ n, p50, min: p50, max: p50 });
  return {
    ...perfWithCost(0.001),
    turns: { measured: n, missing: 0 },
    ttftMs: s(1200),
    durationMs: s(3000),
    tokensPerSecond: s(80),
    inputTokens: s(6000),
    outputTokens: s(300),
  };
}
