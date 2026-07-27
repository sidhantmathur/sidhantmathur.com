// The shapes `scripts/build-measurements.mjs` writes, kept here rather than in
// the generated file so they survive its failure path.
//
// The generated module has two ways out — the normal one and a last-resort
// empty state written from a catch block — and if the types lived inside it,
// those two paths would have to agree on every declaration or the build would
// break in exactly the situation the empty state exists to survive. Here, both
// paths only have to produce two annotated constants.

export type PublishedSuite = {
  name: string;
  total: number;
  passed: number;
  /** Every assertion's name. This is what the published page actually shows. */
  tests: string[];
};

export type PublishedFile = {
  file: string;
  total: number;
  passed: number;
  suites: PublishedSuite[];
};

/**
 * A measured quantity's shape. `n` travels with it because what the page is
 * willing to print is a function of the sample size — a median without its
 * count cannot be held to that policy. Null throughout means NOT MEASURED, and
 * never zero: a turn whose telemetry never arrived must not be able to make a
 * model look like the fastest one on the page.
 */
export type PublishedSample = {
  n: number;
  p50: number;
  min: number;
  max: number;
} | null;

/** Per-turn performance, published for every graded case (Sprint 8). */
export type PublishedTurnPerformance = {
  ttftMs: number | null;
  durationMs: number | null;
  tokensPerSecond: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  steps: number | null;
  finishReason: string | null;
  /** List-price estimate from lib/pricing.ts. Null for an unpriced model. */
  costUsd: number | null;
};

/** A whole run's performance, aggregated over the turns that carried telemetry. */
export type PublishedPerformance = {
  turns: { measured: number; missing: number };
  ttftMs: PublishedSample;
  durationMs: PublishedSample;
  tokensPerSecond: PublishedSample;
  inputTokens: PublishedSample;
  cachedInputTokens: PublishedSample;
  outputTokens: PublishedSample;
  steps: PublishedSample;
  /** Share of INPUT TOKENS served from the prompt cache — not share of turns. */
  cacheHitRate: number | null;
  finishReasons: Record<string, number>;
  cost: {
    pricedTurns: number;
    totalUsd: number;
    perTurnP50Usd: number | null;
    savedUsd: number;
  } | null;
};

export type PublishedCase = {
  group: string;
  id: string;
  label: string | null;
  pass: boolean;
  broke: boolean;
  /** Optional: runs published before Sprint 8 carry no performance record. */
  performance?: PublishedTurnPerformance;
};

export type PublishedRun = {
  model: string;
  ranAt: string | null;
  groups: Record<string, { total: number; passed: number; broke: number }>;
  passed: number;
  total: number;
  /** Turns that failed in transport rather than in judgment (Sprint 1's lesson). */
  broke: number;
  citations: { answers: number; claims: number; verified: number; inventedIds: number };
  /** Optional for the same reason: the archive predates it. */
  performance?: PublishedPerformance;
  cases: PublishedCase[];
};

export type PublishedEvals = {
  publishedAt: string | null;
  static: {
    ranAt: string | null;
    totals: { tests: number; passed: number; failed: number } | null;
    files: PublishedFile[];
  } | null;
  live: { runs: PublishedRun[] };
};

export type ModelLatency = {
  model: string;
  turns: number;
  p50Ms: number | null;
  p95Ms: number | null;
  /** Share of turns the provider served from its prompt cache. */
  cacheHitRate: number | null;
};

export type Analytics =
  | {
      available: false;
      /** Why there is nothing to show. The page prints a sentence per value. */
      reason: "no-credentials" | "no-events" | "query-failed";
      detail: string | null;
    }
  | {
      available: true;
      windowDays: number;
      completedTurns: number;
      failedTurns: number;
      models: ModelLatency[];
      byClass: { class: string; count: number }[];
    };
