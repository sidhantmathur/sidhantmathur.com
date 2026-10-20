// What /measurements/models is allowed to say, and how it derives it. The data
// is generated (lib/measurements.generated.ts) and the rendering is a page; the
// decisions live here so they can be tested without a browser.
//
// The archive holds every published run, so the two jobs here are picking which
// run speaks for a model and refusing to compare runs that aren't comparable.

// Imported by its real filename, like lib/role-fit.ts does, so `node --test`
// can load this module directly for evals/bakeoff.test.mjs.
import { MIN_TURNS_FOR_P50, formatDate, type Maybe } from "./measurements.ts";
import type { PublishedRun, PublishedSample } from "./measurement-types";

/**
 * The most recent run per model. The archive keeps older runs, so every
 * aggregate has to pick one per model or it double-counts models measured
 * twice.
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

/**
 * Where the measured models and the chat's current catalogue part ways: measured
 * models the chat no longer offers, and offered models nothing has measured. A
 * run stays keyed by the id that was measured and is never credited to the
 * model that replaced it.
 *
 * `offered` is passed in rather than imported so that `node --test` can load
 * this module without the catalogue.
 */
export function catalogueDrift(
  measured: readonly string[],
  offered: readonly string[],
): { noLongerOffered: string[]; notMeasured: string[] } {
  const isMeasured = new Set(measured);
  const isOffered = new Set(offered);
  return {
    noLongerOffered: [...isMeasured].filter((id) => !isOffered.has(id)).sort(),
    // Catalogue order, which is the order the dropdown shows them in.
    notMeasured: offered.filter((id) => !isMeasured.has(id)),
  };
}

/** One model's row in the comparison. A metric the run didn't record is null, never zero. */
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
   * Cases the model actually answered: `cases` minus `broke`. This is the
   * denominator under `passRate`, so a dropped stream counts against
   * reliability (`breakRate`), not quality. A deepseek-v4-flash run that passed
   * 15 of 22 while breaking mid-stream on 6 scores 15 of 16, not 68%.
   */
  answered: number;
  passRate: number | null;
  /** Share of attempted turns that never produced an answer. Its own axis. */
  breakRate: number | null;
  groups: { group: string; passed: number; total: number; rate: number | null }[];
  claims: number;
  verified: number;
  /** Withheld under MIN_CLAIMS_FOR_RATE, the same floor as the site-wide figure. */
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
 * Groundedness per model, withheld under the same floor as the site-wide
 * figure. A per-model rate over a handful of claims is, if anything, more
 * misleading than the aggregate.
 */
function groundedRateFor(claims: number, verified: number): Maybe<number> {
  if (claims === 0) return { value: null, reason: "not-measured" };
  // Must equal MIN_CLAIMS_FOR_RATE in lib/measurements.ts.
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

export type FrontierResult = { points: FrontierPoint[]; unplotted: ModelRow[] };

export type FrontierPoint = {
  row: ModelRow;
  /** Cost or latency — lower is better. */
  x: number;
  /** Pass rate — higher is better. */
  y: number;
  /** No other point is both cheaper or faster and better. */
  onFrontier: boolean;
};

/**
 * Pareto frontier over (lower x, higher y): a point is on it when no other point
 * is at least as good on both axes and strictly better on one, so two identical
 * points both stay on.
 *
 * A row missing either axis is not plotted, neither drawn at the origin nor
 * dropped: it comes back in `unplotted` for the caller to report.
 */
export function frontier(
  rows: ModelRow[],
  x: (row: ModelRow) => number | null,
  y: (row: ModelRow) => number | null,
): FrontierResult {
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

export type RankResult = { bars: Ranked[]; missing: ModelRow[] };

export type Ranked = {
  row: ModelRow;
  value: number;
  /** 0..1 against the largest value in the panel. Bar length. */
  fraction: number;
  /** Best on this metric, and the only bar drawn in the accent. */
  best: boolean;
};

/**
 * Which end of a metric is good, or neither. `"none"` is for a metric with no
 * winner, like output tokens per turn: a longer answer isn't a better one, so
 * no bar gets the accent.
 */
export type Direction = "lower" | "higher" | "none";

/**
 * Sorts a metric best-first and normalises it for a bar length. `direction`
 * changes only the order and which bar is emphasised: length always encodes
 * the raw value against the panel's maximum, whichever end is good.
 */
export function rank(
  rows: ModelRow[],
  value: (row: ModelRow) => number | null,
  direction: Direction,
): RankResult {
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
  // Only a unique best gets the accent. A value several models share is shown
  // by the order and the printed numbers; colouring it would highlight the
  // majority and point at nothing.
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
 * Whether a sample is big enough to print a median from: the same floor as the
 * latency panel. Nothing here computes a 95th percentile, which a bake-off with
 * one sample per case can't support.
 */
export function supportsMedian(sample: PublishedSample): boolean {
  return !!sample && sample.n >= MIN_TURNS_FOR_P50;
}

/**
 * The median a sample is allowed to report, or null. Read medians through this
 * rather than `p50` directly, so no caller can skip the floor.
 */
export function median(sample: PublishedSample): number | null {
  return supportsMedian(sample) ? sample!.p50 : null;
}

// --- What the whole bake-off adds up to -------------------------------------

export type BakeoffSummary = {
  /** Turns attempted across every compared run. */
  turnsGraded: number;
  /** Turns that never produced an answer. */
  turnsBroke: number;
  /** Cases in the first run; only meaningful when `uniformCorpus`. */
  casesEach: number;
  /** Every model answered the same number of cases, so they are comparable. */
  uniformCorpus: boolean;
  /**
   * What the whole comparison cost at list price, or null if any row's cost is
   * unknown. A partial sum would read as a cheap total rather than a missing
   * price; the unpriced model is named in the table's price column instead.
   */
  totalCost: number | null;
  /** Run dates, earliest first. Undated runs are not in here. */
  measuredOn: string[];
  /** "27 Jul 2026", "27 Jul 2026 to 29 Jul 2026", or "on an unknown date". */
  measuredRange: string;
};

/** The figures above the charts: the sample everything below rests on. */
export function bakeoffSummary(rows: ModelRow[]): BakeoffSummary {
  const casesEach = rows[0]?.cases ?? 0;
  const measuredOn = rows
    .map((r) => r.ranAt)
    .filter((d): d is string => !!d)
    .sort();

  return {
    turnsGraded: rows.reduce((n, r) => n + r.cases, 0),
    turnsBroke: rows.reduce((n, r) => n + r.broke, 0),
    casesEach,
    uniformCorpus: rows.every((r) => r.cases === casesEach),
    totalCost: rows.reduce<number | null>(
      (n, r) => (n == null || r.costTotalUsd == null ? null : n + r.costTotalUsd),
      0,
    ),
    measuredOn,
    measuredRange: measuredRange(measuredOn),
  };
}

/**
 * How the page says when this was measured: one date, or a span when runs were
 * published on different days, since a bake-off spread over a week is a weaker
 * claim than runs back to back.
 */
export function measuredRange(dates: string[]): string {
  if (!dates.length) return "on an unknown date";
  const first = formatDate(dates[0]);
  const last = formatDate(dates.at(-1));
  return first === last ? first : `${first} to ${last}`;
}

// --- Formatting -------------------------------------------------------------

/** Dollars at the scale a single turn costs. `$0.00` would read as "unmeasured". */
export function formatCost(usd: number | null, decimals = 4): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  return `$${usd.toFixed(decimals)}`;
}

/**
 * What one turn cost, at the precision it needs: four decimals, or five under
 * $0.001, where four would print zeroes and read as free. An unpriced turn is
 * an em dash, never a stand-in number.
 */
export function formatTurnCost(usd: number | null): string {
  return formatCost(usd, usd != null && usd < 0.001 ? 5 : 4);
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
