// The spend cap. The Gateway key is shared with the production chat, and the
// account's budget (about $10 CAD a month) is what keeps that chat alive, so
// the cap is enforced before each call rather than noticed after it:
//
//   1. Before a call, its worst case is priced: every input token at the full
//      input rate (no cache discount) and the whole output ceiling at the
//      output rate. The call is made only if what's spent plus that worst
//      case fits under the cap.
//   2. After it, the call is charged what its usage says, or its worst case
//      when the provider reported no usage.
//   3. Calls run one at a time with retries off, so nothing is in flight that
//      the arithmetic hasn't seen.
//
// List prices come from lib/models.ts. A model whose price is `unconfirmed`
// (DeepSeek billed 3.3 times its headline rate in the bake-off) is budgeted at
// four times list.

import { MODELS } from "../../lib/models.ts";

export const DEFAULT_MAX_USD = 0.5;

/** Budget multiplier by how much a catalogue price can be trusted. */
export const CONFIDENCE_FACTOR = { confirmed: 1, derived: 1.25, unconfirmed: 4 };

/**
 * Dollars per 1M tokens for `model`, with the multiplier to budget at. An
 * explicit `override` ({ input, output }) prices a model the catalogue lacks,
 * at the unconfirmed multiplier. Null when neither knows it.
 */
export function priceFor(model, override) {
  if (override?.input != null && override?.output != null) {
    return { input: override.input, output: override.output, factor: CONFIDENCE_FACTOR.unconfirmed, confidence: "override" };
  }
  const spec = MODELS[model];
  if (!spec) return null;
  return {
    input: spec.input,
    output: spec.output,
    factor: CONFIDENCE_FACTOR[spec.confidence] ?? CONFIDENCE_FACTOR.unconfirmed,
    confidence: spec.confidence,
  };
}

/**
 * A deliberately high token estimate: three characters a token, where English
 * runs nearer four. Used only for the worst case, so erring high is the safe
 * direction.
 */
export function estimateTokens(text) {
  return Math.ceil(String(text).length / 3);
}

/** The most one call can cost. */
export function worstCaseUsd(price, inputTokens, maxOutputTokens) {
  return ((inputTokens * price.input + maxOutputTokens * price.output) / 1e6) * price.factor;
}

/** What a finished call cost by its usage, or null when usage is missing. */
export function usageUsd(price, usage) {
  const input = usage?.inputTokens;
  const output = usage?.outputTokens;
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return ((input * price.input + output * price.output) / 1e6) * price.factor;
}

export class Budget {
  constructor(maxUsd) {
    if (!(maxUsd > 0)) throw new Error(`--max-usd must be a positive number, got ${maxUsd}`);
    this.maxUsd = maxUsd;
    this.spentUsd = 0;
  }

  /** Whether a call whose worst case is `usd` may start. */
  allows(usd) {
    return this.spentUsd + usd <= this.maxUsd;
  }

  charge(usd) {
    this.spentUsd += usd;
  }

  get remainingUsd() {
    return Math.max(0, this.maxUsd - this.spentUsd);
  }
}
