// What /measurements/models is allowed to say, and how it derives it. The data
// is generated (lib/measurements.generated.ts) and the rendering is a page; the
// decisions live here so they can be tested without a browser.
//
// The archive holds every published run, so the two jobs here are picking which
// run speaks for a model and refusing to compare runs that aren't comparable.

// Imported by its real filename, like lib/role-fit.ts does, so `node --test`
// can load this module directly for evals/bakeoff.test.mjs.
import { MIN_TURNS_FOR_P50, formatDate, type Maybe, type Withheld } from "./measurements.ts";
import type { CitationVerdicts, PublishedRun, PublishedSample } from "./measurement-types";

// --- What a chart has no number for, and why ----------------------------------

/**
 * One model a chart couldn't draw, with the reason, so the chart can say which
 * it was. "Not measured" and "measured, but too few turns to report" are
 * opposite things to tell a reader, and collapsing them told the reader the
 * first about a model the run had measured (GitHub issue #2).
 */
export type Missing = { row: ModelRow; reason: Withheld["reason"] };

/**
 * What a chart reads per model: a plain number (null for not measured), or a
 * figure the policy may have withheld. Medians go through `medianOf`, so a
 * `too-few` here always means the median floor, MIN_TURNS_FOR_P50.
 */
export type Reading = number | null | Maybe<number>;

function toMaybe(reading: Reading): Maybe<number> {
  if (reading == null) return { value: null, reason: "not-measured" };
  if (typeof reading === "number") {
    return Number.isFinite(reading)
      ? { value: reading, reason: null }
      : { value: null, reason: "not-measured" };
  }
  if (reading.value != null && !Number.isFinite(reading.value)) {
    return { value: null, reason: "not-measured" };
  }
  return reading;
}

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

/**
 * The archive, split the way both measurement pages read it.
 *
 * `current` is the most recent run of each model the chat offers today, in
 * catalogue order: what the charts compare and what the headline figures are
 * drawn from. `earlier` is every other run, newest first. That means older runs
 * of models still offered, and every run of a model the chat has retired. A
 * retired model's run is never in `current`, however recent it is, and nothing
 * here hands it to a successor.
 */
export function splitArchive(
  runs: PublishedRun[],
  offered: readonly string[],
): { current: PublishedRun[]; earlier: PublishedRun[]; retired: string[] } {
  const order = new Map(offered.map((id, i) => [id, i]));
  const current = latestRunPerModel(runs.filter((r) => order.has(r.model))).sort(
    (a, b) => order.get(a.model)! - order.get(b.model)!,
  );
  const shown = new Set(current);
  const earlier = runs
    .filter((r) => !shown.has(r))
    .sort(
      (a, b) =>
        String(b.ranAt ?? "").localeCompare(String(a.ranAt ?? "")) || a.model.localeCompare(b.model),
    );
  return {
    current,
    earlier,
    retired: catalogueDrift(
      runs.map((r) => r.model),
      offered,
    ).noLongerOffered,
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
  /** The verdict split behind `verified`, where the run published one. */
  verdicts: CitationVerdicts | null;
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
    verdicts: run.citations.verdicts ?? null,
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

export type FrontierResult = { points: FrontierPoint[]; unplotted: Missing[] };

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
 * dropped: it comes back in `unplotted`, with its reason, for the caller to
 * report. An axis that was never measured outranks one that was withheld.
 */
export function frontier(
  rows: ModelRow[],
  x: (row: ModelRow) => Reading,
  y: (row: ModelRow) => Reading,
): FrontierResult {
  const points: FrontierPoint[] = [];
  const unplotted: Missing[] = [];

  for (const row of rows) {
    const xv = toMaybe(x(row));
    const yv = toMaybe(y(row));
    if (xv.value == null || yv.value == null) {
      const reasons = [xv.reason, yv.reason];
      unplotted.push({
        row,
        reason: reasons.includes("not-measured") ? "not-measured" : "too-few",
      });
      continue;
    }
    points.push({ row, x: xv.value, y: yv.value, onFrontier: false });
  }

  for (const p of points) {
    p.onFrontier = !points.some(
      (q) => q !== p && q.x <= p.x && q.y >= p.y && (q.x < p.x || q.y > p.y),
    );
  }

  return { points, unplotted };
}

// --- Where a scatter label goes -----------------------------------------------

export type LabelSpot = { x: number; y: number; anchor: "start" | "end" | "middle" };

type Box = { x0: number; x1: number; y0: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Places each dot's label beside it without landing on another label or dot.
 *
 * The frontier charts used to put every label to the right of its dot (to the
 * left near the right edge), whatever was there. In the 2026-10-20 bake-off
 * gpt-6-luna and deepseek-v4-flash-0731 passed 90.9% and 90.5% of answered
 * cases at neighbouring costs, and the first label ran through the second dot.
 *
 * Each label now tries right, left, above and below, in that order (left first
 * near the right edge), and takes the first spot that stays inside `bounds` and
 * clears every dot and every label already placed. If none does, it takes its
 * first in-bounds spot, which is where it used to go anyway.
 *
 * Widths are estimated from the character count: the labels are 10px Geist
 * Mono, which advances 0.6em a character.
 */
export function placeLabels(
  dots: { x: number; y: number; text: string }[],
  bounds: { x0: number; x1: number },
  { charWidth = 6, gap = 9, dotRadius = 6, flipWithin = 110 } = {},
): LabelSpot[] {
  const dotBoxes: Box[] = dots.map((d) => ({
    x0: d.x - dotRadius,
    x1: d.x + dotRadius,
    y0: d.y - dotRadius,
    y1: d.y + dotRadius,
  }));
  const placed: Box[] = [];

  return dots.map((d, i) => {
    const w = d.text.length * charWidth;
    const right = {
      spot: { x: d.x + gap, y: d.y + 3.5, anchor: "start" as const },
      box: { x0: d.x + gap, x1: d.x + gap + w, y0: d.y - 6, y1: d.y + 5 },
    };
    const left = {
      spot: { x: d.x - gap, y: d.y + 3.5, anchor: "end" as const },
      box: { x0: d.x - gap - w, x1: d.x - gap, y0: d.y - 6, y1: d.y + 5 },
    };
    const above = {
      spot: { x: d.x, y: d.y - 9, anchor: "middle" as const },
      box: { x0: d.x - w / 2, x1: d.x + w / 2, y0: d.y - 18, y1: d.y - 7 },
    };
    const below = {
      spot: { x: d.x, y: d.y + 16, anchor: "middle" as const },
      box: { x0: d.x - w / 2, x1: d.x + w / 2, y0: d.y + 7, y1: d.y + 18 },
    };
    const order = d.x > bounds.x1 - flipWithin ? [left, right, above, below] : [right, left, above, below];
    const inBounds = order.filter((c) => c.box.x0 >= bounds.x0 && c.box.x1 <= bounds.x1);
    const clear = inBounds.find(
      (c) =>
        !placed.some((b) => overlaps(c.box, b)) &&
        !dotBoxes.some((b, j) => j !== i && overlaps(c.box, b)),
    );
    const chosen = clear ?? inBounds[0] ?? order[0];
    placed.push(chosen.box);
    return chosen.spot;
  });
}

// --- Ranked bars ------------------------------------------------------------

export type RankResult = { bars: Ranked[]; missing: Missing[] };

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
 *
 * A model with no number comes back in `missing` with its reason, in row
 * order. Pass a median as `medianOf(...)`, not `median(...)`: the second can't
 * tell a withheld median from an unmeasured one.
 */
export function rank(
  rows: ModelRow[],
  value: (row: ModelRow) => Reading,
  direction: Direction,
): RankResult {
  const bars: { row: ModelRow; value: number }[] = [];
  const missing: Missing[] = [];
  for (const row of rows) {
    const v = toMaybe(value(row));
    if (v.value == null) missing.push({ row, reason: v.reason });
    else bars.push({ row, value: v.value });
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
 * The median a sample is allowed to report, and why not when it isn't: no
 * sample is `not-measured`, a sample under the floor is `too-few`. Charts read
 * medians through this, so they can say which.
 */
export function medianOf(sample: PublishedSample): Maybe<number> {
  if (!sample) return { value: null, reason: "not-measured" };
  if (!supportsMedian(sample)) return { value: null, reason: "too-few" };
  return { value: sample.p50, reason: null };
}

/**
 * The median a sample is allowed to report, or null. Read medians through this
 * or `medianOf` rather than `p50` directly, so no caller can skip the floor.
 */
export function median(sample: PublishedSample): number | null {
  return medianOf(sample).value;
}

// --- Saying what a chart left out ------------------------------------------
//
// "Not measured" and "measured, but withheld" are opposite things to tell a
// reader. The charts used to say the first about both, so a model whose run was
// measured over too few turns for a median was reported as never measured
// (GitHub issue #2). Every withheld figure a chart receives is a median read
// through `medianOf`, so the floor named here is the median's.

/** "gpt-5-mini, gemini-3.5-flash" — models named in a trailer, never ids. */
export function shortNames(rows: ModelRow[]): string {
  return rows.map((row) => row.short).join(", ");
}

/** The models a chart left out, split by why. */
export function missingByReason(missing: Missing[]): {
  tooFew: ModelRow[];
  notMeasured: ModelRow[];
} {
  return {
    tooFew: missing.filter((m) => m.reason === "too-few").map((m) => m.row),
    notMeasured: missing.filter((m) => m.reason === "not-measured").map((m) => m.row),
  };
}

/** What a ranked panel says under its bars about the models it has none for. */
export function rankedTrailer(missing: Missing[]): string | undefined {
  const { tooFew, notMeasured } = missingByReason(missing);
  const sentences: string[] = [];
  if (tooFew.length) {
    sentences.push(
      `Median withheld for ${shortNames(tooFew)}: fewer than ${MIN_TURNS_FOR_P50} measured turns.`,
    );
  }
  if (notMeasured.length) sentences.push(`Not measured for ${shortNames(notMeasured)}.`);
  return sentences.length ? sentences.join(" ") : undefined;
}

/**
 * What a frontier chart says about the dots it couldn't draw, as sentences to
 * follow its own; empty when every model is plotted.
 */
export function unplottedTrailer(unplotted: Missing[]): string {
  const { tooFew, notMeasured } = missingByReason(unplotted);
  const sentences: string[] = [];
  if (notMeasured.length) {
    sentences.push(
      `${shortNames(notMeasured)} could not be plotted because one of the two axes was not measured.`,
    );
  }
  if (tooFew.length) {
    const whose = tooFew.length === 1 ? "its median was" : "their medians were";
    sentences.push(
      `${shortNames(tooFew)} could not be plotted because ${whose} withheld: fewer than ${MIN_TURNS_FOR_P50} measured turns.`,
    );
  }
  return sentences.join(" ");
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
