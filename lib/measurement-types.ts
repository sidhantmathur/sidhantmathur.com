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

export type PublishedRun = {
  model: string;
  ranAt: string | null;
  groups: Record<string, { total: number; passed: number; broke: number }>;
  passed: number;
  total: number;
  /** Turns that failed in transport rather than in judgment (Sprint 1's lesson). */
  broke: number;
  citations: { answers: number; claims: number; verified: number; inventedIds: number };
  cases: { group: string; id: string; label: string | null; pass: boolean; broke: boolean }[];
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
