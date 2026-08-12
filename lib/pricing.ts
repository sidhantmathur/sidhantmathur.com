// Turn cost, in dollars (roadmap Sprint 2, #1 — the real cost meter).
//
// F1 already puts token counts on the client. This turns them into money, which
// is the whole point of A8: the "17/20" strip asserts that someone thought about
// cost; a per-turn dollar figure with the cached-input line broken out PROVES
// it.
//
// This file is the ARITHMETIC. The per-model numbers it works on — prices, cache
// rates, how far each is to be trusted, and the reasoning behind the allowlist
// they belong to — are one table in `lib/models.ts`, which is also what the
// route, the dropdown and the bake-off script read. Two views of that table are
// re-exported here so that everything costing a turn keeps importing one module.
//
// Anything rendering these must label the result as an estimate at list price.

import { MODELS, PRICES_CHECKED, type PriceConfidence } from "./models.ts";

export { PRICES_CHECKED };
export type { PriceConfidence };

/** Dollars per 1M tokens. */
type ModelPrice = {
  input: number;
  output: number;
  /** Input tokens served from the provider's prompt cache. */
  cacheRead: number;
  /** Input tokens written into the cache. Zero where the provider doesn't bill it. */
  cacheWrite: number;
};

// Every allowlisted model, priced. An unknown model is priced as null rather
// than guessed — see costOfTurn. The catalogue is what makes "allowlisted" and
// "priced" the same set rather than two sets that agree today.
export const MODEL_PRICES: Record<string, ModelPrice> = Object.fromEntries(
  Object.entries(MODELS).map(([id, spec]) => [
    id,
    {
      input: spec.input,
      output: spec.output,
      cacheRead: spec.cacheRead,
      cacheWrite: spec.cacheWrite,
    },
  ]),
);

/** How much to trust each row above. See `lib/models.ts` for what each means. */
export const PRICE_CONFIDENCE: Record<string, PriceConfidence> = Object.fromEntries(
  Object.entries(MODELS).map(([id, spec]) => [id, spec.confidence]),
);

export type TurnCost = {
  /** Input tokens that were neither read from nor written to the cache. */
  freshInput: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  /** Sum of the four above. */
  total: number;
  /**
   * What the cache-read tokens WOULD have cost at the full input price, minus
   * what they actually cost. The number A8 wanted on the screen.
   */
  saved: number;
};

const ZERO: TurnCost = {
  freshInput: 0,
  cacheRead: 0,
  cacheWrite: 0,
  output: 0,
  total: 0,
  saved: 0,
};

type UsageLike = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  outputTokens: number | null;
} | null;

/**
 * Costs one turn at list price. Returns null for a model with no price entry —
 * the meter renders "—" rather than a number it made up.
 */
export function costOfTurn(model: string, usage: UsageLike): TurnCost | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  if (!usage) return ZERO;

  const input = usage.inputTokens ?? 0;
  const cacheRead = usage.cachedInputTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  // `inputTokens` is the SDK's total, cached and uncached. Clamped because a
  // provider that reports them separately would otherwise go negative here.
  const fresh = Math.max(0, input - cacheRead - cacheWrite);

  const per = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;
  const cost: TurnCost = {
    freshInput: per(fresh, price.input),
    cacheRead: per(cacheRead, price.cacheRead),
    cacheWrite: per(cacheWrite, price.cacheWrite),
    output: per(output, price.output),
    total: 0,
    saved: per(cacheRead, price.input) - per(cacheRead, price.cacheRead),
  };
  cost.total = cost.freshInput + cost.cacheRead + cost.cacheWrite + cost.output;
  return cost;
}

/** Adds costed turns. Nulls (unpriced models) are skipped, not treated as zero. */
export function sumCosts(costs: (TurnCost | null)[]): TurnCost {
  return costs.reduce<TurnCost>((acc, c) => {
    if (!c) return acc;
    return {
      freshInput: acc.freshInput + c.freshInput,
      cacheRead: acc.cacheRead + c.cacheRead,
      cacheWrite: acc.cacheWrite + c.cacheWrite,
      output: acc.output + c.output,
      total: acc.total + c.total,
      saved: acc.saved + c.saved,
    };
  }, ZERO);
}

/**
 * Money, to four decimals — A8's ask. A turn here costs a fraction of a cent,
 * so two decimals would render every honest number as $0.00, which reads as
 * "we didn't measure it".
 */
export function formatUsd(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toFixed(decimals)}`;
}

/** 12345 → "12.3k". Token counts get wide fast and the strip is one line. */
export function formatTokens(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(1)}k`;
}
