// Turns a live run's per-turn telemetry into the performance record the
// comparison page plots (Sprint 8).
//
// The runner has always recorded the full Sprint 1 telemetry against every
// turn — time to first token, duration, output tokens per second, input tokens,
// cached input tokens, output tokens, steps, finish reason. The publisher used
// to drop all of it and keep the verdicts, so the site could say a model passed
// 6 of 6 and could not say what that cost or how long it took. This is the part
// that stopped being thrown away.
//
// Two rules this file exists to hold:
//
//   1. A MISSING MEASUREMENT IS NULL, NEVER ZERO. A turn whose telemetry never
//      arrived contributes to nothing here. Averaging a missing TTFT in as 0 ms
//      would make a broken run look like the fastest one on the page, which is
//      the precise failure the whole /measurements design is built against.
//   2. COST IS AN ESTIMATE AT LIST PRICE and is computed by `lib/pricing.ts`,
//      the same function the per-turn meter in the shell uses. An unpriced
//      model costs `null`, not `0` — see `costOfTurn`.

import { costOfTurn, sumCosts } from "../../lib/pricing.ts";

/** Median. Returns null for an empty sample rather than NaN or 0. */
export function median(values) {
  const sorted = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * A sample's shape, or null if nothing was measured.
 *
 * `n` travels with every one of these on purpose: the page's whole policy for
 * what it is willing to print is a function of the sample size, and a summary
 * that reports a median without the count it came from cannot be held to it.
 */
export function sample(values) {
  const clean = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!clean.length) return null;
  return {
    n: clean.length,
    p50: median(clean),
    min: Math.min(...clean),
    max: Math.max(...clean),
  };
}

/** The per-turn performance row published for one graded case. */
export function turnPerformance(result) {
  const t = result?.telemetry ?? null;
  const usage = t?.usage ?? null;
  const cost = t?.model ? costOfTurn(t.model, usage) : null;
  return {
    ttftMs: t?.timing?.ttftMs ?? null,
    durationMs: t?.timing?.durationMs ?? null,
    tokensPerSecond: t?.timing?.tokensPerSecond ?? null,
    inputTokens: usage?.inputTokens ?? null,
    cachedInputTokens: usage?.cachedInputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    steps: t?.steps ?? null,
    finishReason: t?.finishReason ?? null,
    costUsd: cost ? cost.total : null,
  };
}

/**
 * Aggregates a run's turns.
 *
 * Only turns that carried telemetry count. A turn that broke in transport has
 * no timing to contribute and is counted in `turns.missing` instead — the same
 * separation the verdicts already make between failing and never running.
 */
export function runPerformance(results) {
  const rows = results.map((r) => ({ result: r, perf: turnPerformance(r) }));
  const measured = rows.filter(({ perf }) => perf.ttftMs != null || perf.outputTokens != null);

  const of = (key) => measured.map(({ perf }) => perf[key]);

  // Priced separately from summed, because a run on an unpriced model must
  // report "not priced" rather than a total of zero dollars.
  const costs = measured.map(({ result }) =>
    result?.telemetry?.model
      ? costOfTurn(result.telemetry.model, result.telemetry.usage ?? null)
      : null,
  );
  const pricedCosts = costs.filter(Boolean);
  const totals = pricedCosts.length ? sumCosts(pricedCosts) : null;

  // Cache hit rate is measured over input tokens, not over turns: this workload
  // sends a ~5k-token system prompt on every turn against a few hundred tokens
  // of question, so "what share of the input was cheap" is the number that
  // explains the bill. A per-turn hit rate would read as 100% and explain
  // nothing.
  const inputTotal = of("inputTokens").reduce((n, v) => n + (v ?? 0), 0);
  const cachedTotal = of("cachedInputTokens").reduce((n, v) => n + (v ?? 0), 0);

  const finishReasons = {};
  for (const { perf } of measured) {
    if (perf.finishReason) finishReasons[perf.finishReason] = (finishReasons[perf.finishReason] ?? 0) + 1;
  }

  return {
    turns: { measured: measured.length, missing: rows.length - measured.length },
    ttftMs: sample(of("ttftMs")),
    durationMs: sample(of("durationMs")),
    tokensPerSecond: sample(of("tokensPerSecond")),
    inputTokens: sample(of("inputTokens")),
    cachedInputTokens: sample(of("cachedInputTokens")),
    outputTokens: sample(of("outputTokens")),
    steps: sample(of("steps")),
    cacheHitRate: inputTotal > 0 ? cachedTotal / inputTotal : null,
    finishReasons,
    cost: totals
      ? {
          /** Turns the cost figures were computed from — never all of them if a model is unpriced. */
          pricedTurns: pricedCosts.length,
          totalUsd: totals.total,
          perTurnP50Usd: median(pricedCosts.map((c) => c.total)),
          /** What prompt caching took off the bill, at list price. */
          savedUsd: totals.saved,
        }
      : null,
  };
}
