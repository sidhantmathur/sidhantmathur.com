// Turn cost, in dollars (roadmap Sprint 2, #1 — the real cost meter).
//
// F1 already puts token counts on the client. This turns them into money, which
// is the whole point of A8: the "17/20" strip asserts that someone thought about
// cost; a per-turn dollar figure with the cached-input line broken out PROVES
// it. The input-dominated analysis that picked the model allowlist lives in a
// comment in `app/api/chat/route.ts` and is invisible to the audience it would
// impress most.
//
// HONESTY, because this is a site about instrumentation being honest:
//
//   * These are LIST prices, per 1M tokens, as published on the Vercel AI
//     Gateway model list and checked on the date below. They are what the meter
//     estimates with. They are not an invoice.
//   * `input` and `output` are the two numbers already recorded against each
//     model in `route.ts`. They are the ones to trust.
//   * `cacheRead` and `cacheWrite` are mostly DERIVED — each provider's
//     published discount/surcharge applied to that model's input price, rather
//     than a separately checked figure. Where a provider publishes the cached
//     rate directly it is used as published and the comment says so.
//
// Anything rendering these must label the result as an estimate at list price.
//
// RE-CHECKED 2026-07-27 (roadmap Sprint 6, following Sprint 2's finding 3).
// What that check found, per row, is in the comments below. The short version:
//   * Anthropic's 0.1x read / 1.25x five-minute write are documented, and
//     haiku 4.5's $1.00/$5.00 confirms — this row is verified end to end.
//   * gpt-5-mini and gemini-3.5-flash-lite have confirmed input/output prices
//     and still-derived cache rates.
//   * deepseek-v4-flash was WRONG in both directions and is corrected here:
//     input and output were understated, and the derived cache read was more
//     than three times the published cache-hit rate. Sprint 2 called the
//     derived figures the soft numbers in this file; the check found the
//     supposedly-solid ones were the problem on this row.
//   * gpt-5.6-luna could not be confirmed and is marked as such.
//
// Nothing on /measurements is denominated in money, deliberately, so no
// published aggregate depends on any of these.

/** When the `input`/`output` prices below were last checked against the Gateway. */
export const PRICES_CHECKED = "2026-07-27";

/** Dollars per 1M tokens. */
type ModelPrice = {
  input: number;
  output: number;
  /** Input tokens served from the provider's prompt cache. */
  cacheRead: number;
  /** Input tokens written into the cache. Zero where the provider doesn't bill it. */
  cacheWrite: number;
};

// Keys must stay in step with the `MODELS` allowlist in app/api/chat/route.ts.
// An unknown model is priced as null rather than guessed — see costOfTurn.
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Anthropic: cache reads bill at 0.1x input, 5-minute cache writes at 1.25x.
  // Verified 2026-07-27: $1.00/$5.00 per 1M, and both multipliers are published.
  "anthropic/claude-haiku-4.5": { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
  // OpenAI: cached input is discounted to 0.1x; cache writes are not billed.
  // Input/output confirmed 2026-07-27; the cache rate is still derived.
  "openai/gpt-5-mini": { input: 0.25, output: 2.0, cacheRead: 0.025, cacheWrite: 0 },
  // UNCONFIRMED as of 2026-07-27 — neither the input/output pair nor the cache
  // discount could be checked against a published rate. Treat as the least
  // trustworthy row here.
  "openai/gpt-5.6-luna": { input: 1.0, output: 6.0, cacheRead: 0.1, cacheWrite: 0 },
  // Google: cached input is discounted to 0.25x; storage is billed by time, not
  // by token, and this workload never holds an explicit cache, so it's zero.
  // Input/output confirmed 2026-07-27; the cache rate is still derived.
  "google/gemini-3.5-flash-lite": { input: 0.3, output: 2.5, cacheRead: 0.075, cacheWrite: 0 },
  // DeepSeek publishes the cache-hit rate directly rather than as a multiplier,
  // and it is ~50x below a miss, not the ~10x this row previously assumed.
  // Corrected 2026-07-27: input was 0.09 (published 0.14), output was 0.18
  // (published 0.28), and cacheRead was a derived 0.009 against a published
  // 0.0028. This is the one row here whose cache read is NOT derived.
  "deepseek/deepseek-v4-flash": { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
};

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
