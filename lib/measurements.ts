// The policy behind what /measurements is willing to print (Sprint 6).
//
// Separate from the data (lib/measurements.generated.ts) and from the rendering
// (app/measurements/page.tsx) because these are the decisions worth arguing
// about, and they should be readable and testable without a browser.
//
// The rule underneath all of it: a percentile computed from four samples is a
// number with the typography of a measurement and the information content of a
// guess. Sprint 2 kept an estimate and a measurement visually distinct rather
// than collapsing them; the equivalent here is refusing to print a statistic the
// sample cannot support, and saying how many samples there are instead.

import type { ModelLatency, PublishedRun } from "./measurement-types";

/**
 * Below this many checkable claims, the groundedness section reports the raw
 * counts and no rate. 3 of 6 is not "50%" in any sense a reader should carry
 * away, and printing it as one would be the single most misleading number this
 * site could publish about itself.
 */
export const MIN_CLAIMS_FOR_RATE = 20;

/** A median needs a shape. Under this, the page shows the sample count only. */
export const MIN_TURNS_FOR_P50 = 10;

/**
 * A 95th percentile is the second-slowest of twenty. Under this many turns it
 * is essentially "the slowest one we saw", which is a maximum wearing a
 * percentile's name.
 */
export const MIN_TURNS_FOR_P95 = 50;

export type Withheld = { value: null; reason: "too-few" | "not-measured" };
export type Reported<T> = { value: T; reason: null };
export type Maybe<T> = Reported<T> | Withheld;

function report<T>(value: T): Reported<T> {
  return { value, reason: null };
}
function withhold(reason: Withheld["reason"]): Withheld {
  return { value: null, reason };
}

/** What a model's latency row is allowed to say, given how many turns it has. */
export function latencyReadout(m: ModelLatency): {
  turns: number;
  p50Ms: Maybe<number>;
  p95Ms: Maybe<number>;
  cacheHitRate: Maybe<number>;
} {
  return {
    turns: m.turns,
    p50Ms:
      m.p50Ms == null
        ? withhold("not-measured")
        : m.turns < MIN_TURNS_FOR_P50
          ? withhold("too-few")
          : report(m.p50Ms),
    p95Ms:
      m.p95Ms == null
        ? withhold("not-measured")
        : m.turns < MIN_TURNS_FOR_P95
          ? withhold("too-few")
          : report(m.p95Ms),
    // A rate over n turns is a rate over n turns; unlike a percentile it
    // degrades gracefully, so it uses the same floor as the median rather than
    // a stricter one.
    cacheHitRate:
      m.cacheHitRate == null
        ? withhold("not-measured")
        : m.turns < MIN_TURNS_FOR_P50
          ? withhold("too-few")
          : report(m.cacheHitRate),
  };
}

export type Groundedness = {
  /** Models whose runs contributed. */
  models: string[];
  /** Answers that contained at least one checkable claim. */
  answers: number;
  claims: number;
  verified: number;
  /** Cited ids that don't exist in the corpus. Should always be zero. */
  inventedIds: number;
  /** Null until there are enough claims to mean anything. */
  rate: Maybe<number>;
  /**
   * The eval groups behind the number. Load-bearing: the job-description group
   * cites almost nothing by construction (Sprint 3's finding 4), so a figure
   * drawn only from `roleFit` measures something different from one drawn from
   * `grounded`, and the page has to say which it is.
   */
  groups: string[];
};

/**
 * #22, and the reason it is gated on #2: this reads the published eval snapshot
 * and nothing else. No snapshot, no number — which is the gate, in code.
 */
export function groundedness(runs: PublishedRun[]): Groundedness | null {
  const contributing = runs.filter((r) => r.citations.claims > 0);
  if (!contributing.length) return null;

  const claims = contributing.reduce((n, r) => n + r.citations.claims, 0);
  const verified = contributing.reduce((n, r) => n + r.citations.verified, 0);
  const groups = new Set<string>();
  for (const run of contributing) {
    for (const g of Object.keys(run.groups)) groups.add(g);
  }

  return {
    models: contributing.map((r) => r.model),
    answers: contributing.reduce((n, r) => n + r.citations.answers, 0),
    claims,
    verified,
    inventedIds: contributing.reduce((n, r) => n + r.citations.inventedIds, 0),
    rate: claims < MIN_CLAIMS_FOR_RATE ? withhold("too-few") : report(verified / claims),
    groups: [...groups].sort(),
  };
}

/** Turns that completed, over turns that were attempted. */
export function successRate(completed: number, failed: number): Maybe<number> {
  const total = completed + failed;
  if (total === 0) return withhold("not-measured");
  if (total < MIN_TURNS_FOR_P50) return withhold("too-few");
  return report(completed / total);
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value >= 0.995 || value === 0 ? 0 : 1)}%`;
}

/** `2026-07-27T20:00:28Z` → `27 Jul 2026`. Undated things say so. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "date unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "date unknown";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
