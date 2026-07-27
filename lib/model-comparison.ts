// What /measurements/models is allowed to say, and how it derives it (Sprint 8).
//
// Same split as Sprint 6: the data is generated (lib/measurements.generated.ts),
// the rendering is a page, and the DECISIONS live here where they can be read
// and tested without a browser.
//
// The archive holds every run ever published, so the first job here is picking
// which run speaks for a model — and the second is refusing to compare runs
// that aren't comparable. Both are policy, not formatting.

// By its real filename, the same convention lib/role-fit.ts uses, so
// `node --test` can load this module directly for evals/bakeoff.test.mjs.
import { MIN_TURNS_FOR_P50, type Maybe } from "./measurements.ts";
import type { PublishedRun, PublishedSample } from "./measurement-types";

/**
 * The most recent run per model.
 *
 * The archive deliberately keeps older runs. Every aggregate on the site has to
 * pick one per model or it double-counts the models that were measured twice —
 * which is exactly the bug the archive would have introduced into Sprint 6's
 * groundedness figure if this didn't exist.
 */
export function latestRunPerModel(runs: PublishedRun[]): PublishedRun[] {
  const byModel = new Map<string, PublishedRun>();
  for (const run of runs) {
    const held = byModel.get(run.model);
    if (!held || String(run.ranAt ?? "") > String(held.ranAt ?? "")) byModel.set(run.model, run);
  }
  return [...byModel.values()].sort((a, b) => a.model.localeCompare(b.model));
}

/** Runs for a model, newest first. Feeds the archive section. */
export function runHistory(runs: PublishedRun[]): { model: string; runs: PublishedRun[] }[] {
  const byModel = new Map<string, PublishedRun[]>();
  for (const run of runs) {
    byModel.set(run.model, [...(byModel.get(run.model) ?? []), run]);
  }
  return [...byModel.entries()]
    .map(([model, list]) => ({
      model,
      runs: [...list].sort((a, b) => String(b.ranAt ?? "").localeCompare(String(a.ranAt ?? ""))),
    }))
    .sort((a, b) => a.model.localeCompare(b.model));
}

/** One model's row in the comparison. Every number here is nullable on purpose. */
export type ModelRow = {
  model: string;
  /** Short label for a chart axis: the model id without its provider prefix. */
  short: string;
  provider: string;
  ranAt: string | null;
  /** Cases attempted. */
  cases: number;
  passed: number;
  /** Turns that failed in transport or mid-stream rather than in judgment. */
  broke: number;
  /**
   * Cases the model actually answered — `cases` minus `broke`. THE DENOMINATOR
   * UNDER `passRate`, and the reason this field exists.
   *
   * A measured run of deepseek-v4-flash passed 15 of 22 while breaking
   * mid-stream on 6 of them. Over `cases` that reads as 68% and puts the model
   * near the bottom of the quality axis; over answered cases it is 15 of 16,
   * and the reliability problem is a separate fact reported beside it. Scoring
   * a dropped stream as a wrong answer is the exact confusion the rest of this
   * codebase is built to avoid, and it must not be reintroduced by a chart.
   */
  answered: number;
  passRate: number | null;
  /** Share of attempted turns that never produced an answer. Its own axis. */
  breakRate: number | null;
  groups: { group: string; passed: number; total: number; rate: number | null }[];
  claims: number;
  verified: number;
  /** Withheld under MIN_CLAIMS_FOR_RATE — same policy Sprint 6 set. */
  groundedRate: Maybe<number>;
  ttftMs: PublishedSample;
  durationMs: PublishedSample;
  tokensPerSecond: PublishedSample;
  inputTokens: PublishedSample;
  outputTokens: PublishedSample;
  cacheHitRate: number | null;
  /** Median dollars per graded turn, at list price. */
  costPerTaskUsd: number | null;
  costTotalUsd: number | null;
  costSavedUsd: number | null;
  /** True when the run predates the performance record and has none. */
  performanceMissing: boolean;
};

const rate = (passed: number, total: number) => (total > 0 ? passed / total : null);

export function toRow(run: PublishedRun): ModelRow {
  const [provider, ...rest] = run.model.split("/");
  const perf = run.performance;
  const claims = run.citations.claims;
  const verified = run.citations.verified;

  return {
    model: run.model,
    short: rest.join("/") || run.model,
    provider: provider ?? "",
    ranAt: run.ranAt,
    cases: run.total,
    passed: run.passed,
    broke: run.broke,
    answered: run.total - run.broke,
    passRate: rate(run.passed, run.total - run.broke),
    breakRate: rate(run.broke, run.total),
    groups: Object.entries(run.groups)
      // Same denominator per group, for the same reason.
      .map(([group, g]) => ({
        group,
        passed: g.passed,
        total: g.total - g.broke,
        rate: rate(g.passed, g.total - g.broke),
      }))
      .sort((a, b) => a.group.localeCompare(b.group)),
    claims,
    verified,
    groundedRate: groundedRateFor(claims, verified),
    ttftMs: perf?.ttftMs ?? null,
    durationMs: perf?.durationMs ?? null,
    tokensPerSecond: perf?.tokensPerSecond ?? null,
    inputTokens: perf?.inputTokens ?? null,
    outputTokens: perf?.outputTokens ?? null,
    cacheHitRate: perf?.cacheHitRate ?? null,
    costPerTaskUsd: perf?.cost?.perTurnP50Usd ?? null,
    costTotalUsd: perf?.cost?.totalUsd ?? null,
    costSavedUsd: perf?.cost?.savedUsd ?? null,
    performanceMissing: !perf,
  };
}

/**
 * Groundedness per model, under Sprint 6's floor.
 *
 * Imported rather than re-derived so one model's rate can never be computed by
 * a rule the site-wide figure doesn't use. Kept local (not re-exported from
 * measurements.ts) because the floor there is documented against the aggregate.
 */
function groundedRateFor(claims: number, verified: number): Maybe<number> {
  if (claims === 0) return { value: null, reason: "not-measured" };
  // Deliberately the same constant as the aggregate. A per-model rate over a
  // handful of claims is if anything more misleading, not less.
  if (claims < 20) return { value: null, reason: "too-few" };
  return { value: verified / claims, reason: null };
}

/** Every group name across the compared runs, in a stable order for the heatmap. */
export function allGroups(rows: ModelRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const g of row.groups) seen.add(g.group);
  return [...seen].sort();
}

// --- The frontier -----------------------------------------------------------

export type FrontierPoint = {
  row: ModelRow;
  /** Cost or latency — lower is better. */
  x: number;
  /** Pass rate — higher is better. */
  y: number;
  /** Nothing measured here is both cheaper/faster AND better. */
  onFrontier: boolean;
};

/**
 * Pareto frontier over (lower x, higher y).
 *
 * This is the only place the page decides which models to emphasise, and it is
 * arithmetic rather than opinion: a point is on the frontier when no other point
 * beats it on both axes. Ties count as beaten only when the other point is
 * strictly better somewhere — otherwise two identical models would knock each
 * other off and the chart would emphasise nothing.
 *
 * A model missing either axis is not plotted at all. It is not a point at the
 * origin, and it is not silently dropped either — the caller reports it.
 */
export function frontier(
  rows: ModelRow[],
  x: (row: ModelRow) => number | null,
  y: (row: ModelRow) => number | null,
): { points: FrontierPoint[]; unplotted: ModelRow[] } {
  const points: FrontierPoint[] = [];
  const unplotted: ModelRow[] = [];

  for (const row of rows) {
    const xv = x(row);
    const yv = y(row);
    if (xv == null || yv == null || !Number.isFinite(xv) || !Number.isFinite(yv)) {
      unplotted.push(row);
      continue;
    }
    points.push({ row, x: xv, y: yv, onFrontier: false });
  }

  for (const p of points) {
    p.onFrontier = !points.some(
      (q) => q !== p && q.x <= p.x && q.y >= p.y && (q.x < p.x || q.y > p.y),
    );
  }

  return { points, unplotted };
}

// --- Ranked bars ------------------------------------------------------------

export type Ranked = {
  row: ModelRow;
  value: number;
  /** 0..1 against the largest value in the panel. Bar length. */
  fraction: number;
  /** Best on this metric — the one bar that wears the accent. */
  best: boolean;
};

/**
 * Which end of a metric is good — or neither.
 *
 * `"none"` is not a formality. "Output tokens per turn" has no winner: a longer
 * answer is not a better one, and it is also the output side of the bill. A
 * panel that painted the longest bar with the accent would be asserting a
 * preference the measurement does not contain, which is the quiet way a chart
 * starts lying.
 */
export type Direction = "lower" | "higher" | "none";

/**
 * Sorts a metric best-first and normalises it for a bar length.
 *
 * `direction` only changes the ORDER and which bar is emphasised, never the bar
 * length: length always encodes the raw magnitude against the panel's maximum,
 * so a 4-second bar is visibly four times a 1-second bar whether the metric is
 * one where less is better or more is.
 */
export function rank(
  rows: ModelRow[],
  value: (row: ModelRow) => number | null,
  direction: Direction,
): { bars: Ranked[]; missing: ModelRow[] } {
  const bars: { row: ModelRow; value: number }[] = [];
  const missing: ModelRow[] = [];
  for (const row of rows) {
    const v = value(row);
    if (v == null || !Number.isFinite(v)) missing.push(row);
    else bars.push({ row, value: v });
  }
  if (!bars.length) return { bars: [], missing };

  const max = Math.max(...bars.map((b) => b.value));
  const bestValue =
    direction === "lower"
      ? Math.min(...bars.map((b) => b.value))
      : direction === "higher"
        ? Math.max(...bars.map((b) => b.value))
        : null;
  // Emphasis is for a winner, and a value four models share is not one. The
  // reliability panel is where this showed: four of five broke on zero turns,
  // so four of five bars wore the accent and read "most reliable" — the accent
  // spread across the majority, pointing at nothing, while the one model that
  // actually differed sat in context grey. A tie is communicated by the
  // ordering and the printed values; it does not need a colour.
  const unique = bestValue != null && bars.filter((b) => b.value === bestValue).length === 1;

  return {
    bars: bars
      .sort((a, b) => (direction === "lower" ? a.value - b.value : b.value - a.value))
      .map((b) => ({
        ...b,
        fraction: max > 0 ? b.value / max : 0,
        best: unique && b.value === bestValue,
      })),
    missing,
  };
}

// --- What the sample supports ----------------------------------------------

/**
 * Whether a run is big enough for the page to print medians from it.
 *
 * Same floor as the latency panel. A bake-off with one sample per case has no
 * business printing a 95th percentile, which is why nothing here computes one.
 */
export function supportsMedian(sample: PublishedSample): boolean {
  return !!sample && sample.n >= MIN_TURNS_FOR_P50;
}

// --- Formatting -------------------------------------------------------------

/** Dollars at the scale a single turn costs. `$0.00` would read as "unmeasured". */
export function formatCost(usd: number | null, decimals = 4): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  return `$${usd.toFixed(decimals)}`;
}

/** 6013 → "6.0k". Axis ticks and table cells. */
export function formatCount(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1000) return String(Math.round(value));
  return `${(value / 1000).toFixed(1)}k`;
}

export function formatSeconds(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}
