// The model catalogue: the chat route's allowlist, the shell's picker, the cost
// meter and the bake-off all read from here.
//
// The client picks a model, so this is a security and a cost boundary: the id
// in a request is only a lookup key into MODELS, never passed to the Gateway.
//
// Prices are list prices per 1M tokens from the Vercel AI Gateway
// (https://ai-gateway.vercel.sh/v1/models and /v1/models/{id}/endpoints) as of
// PRICES_CHECKED. Anything rendering them must label the result as an estimate
// at list price. Published bake-off costs keep the prices on record when each
// run was published and are not recomputed from this table.

/** When the `input`/`output` prices below were last checked against the Gateway. */
export const PRICES_CHECKED = "2026-10-19";

/**
 *   confirmed — input and output checked against a published rate on PRICES_CHECKED
 *   derived   — input/output confirmed; the cache rate is a published multiplier
 *               applied to input rather than a separately published figure
 *   unconfirmed — no checked rate can be said to apply to a turn: either none
 *               was published, or several are and the meter cannot see which
 *               one billed. Least trustworthy row here; its comment says which.
 */
export type PriceConfidence = "confirmed" | "derived" | "unconfirmed";

/**
 * AI SDK 7's top-level `reasoning` option, which the Gateway translates into
 * each provider's own setting. Restated rather than imported so this file stays
 * dependency-free: the evals import it under plain `node --test`. The route
 * passes one straight to `streamText`, so the type checker keeps the two lists
 * in step.
 */
export type ReasoningLevel =
  | "provider-default"
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

/**
 * How hard one model thinks, by kind of turn; an absent key means the
 * provider's default. Split because the two fail differently: an ordinary turn
 * has a 600-token ceiling a thinking model can exhaust before saying a word,
 * while a job-posting turn has room but runs three steps, so hidden reasoning
 * is most of the wait.
 */
export type ReasoningSetting = {
  /** Every turn that is not a pasted job posting. */
  chat?: ReasoningLevel;
  /** A pasted job posting: extract, judge, then the sentence after. */
  jobPosting?: ReasoningLevel;
};

/** One model. Prices are dollars per 1M tokens. */
export type ModelSpec = {
  input: number;
  output: number;
  /** Input tokens served from the provider's prompt cache. */
  cacheRead: number;
  /** Input tokens written into the cache. Zero where the provider doesn't bill it. */
  cacheWrite: number;
  confidence: PriceConfidence;
  /** Optional. Absent means the provider's default reasoning on every turn. */
  reasoning?: ReasoningSetting;
};

// Order is the dropdown order: the default first, then cheapest first. The
// shell selects the first entry on load, so it must be DEFAULT_MODEL.
export const MODELS = {
  // Short-context rates; the long-context tier starts at 272k tokens. OpenAI,
  // Azure and Bedrock all bill the same. `low` reasoning on postings brought
  // the card from 28–33 s to 13–14 s with the same requirements extracted
  // (docs/followups.md §2); ordinary turns were never slow.
  "openai/gpt-6-luna": {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
    confidence: "confirmed",
    reasoning: { jobPosting: "low" },
  },
  // Fifteen providers serve this snapshot at $0.02–$0.44 input and
  // $0.15–$1.32 output; these are the cheapest, headline rates. The route
  // doesn't pin a provider and the meter can't see which one billed, so any
  // given turn's price is unconfirmed and could be several times low. The newer
  // deepseek-v4.1-flash isn't a fix: its first-party rate doubles at weekday
  // peak. At its default reasoning level this model can spend a turn's whole
  // output cap thinking.
  "deepseek/deepseek-v4-flash-0731": {
    input: 0.076,
    output: 0.153,
    cacheRead: 0.014,
    cacheWrite: 0,
    confidence: "unconfirmed",
  },
  // Rates for prompts up to 100k tokens ($0.50/$2.50 beyond); a turn here is
  // nowhere near. Cache writes are the 5-minute rate. It thinks by default and
  // thinking bills as output, so it can spend a whole 600-token turn before
  // writing anything.
  "anthropic/claude-haiku-5.5": {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
    confidence: "confirmed",
  },
  // OpenAI doesn't bill cache writes. Azure's cached rate is $0.03 against
  // OpenAI's $0.025; the meter uses OpenAI's. A reasoning model, so it too can
  // spend the whole output cap before answering.
  "openai/gpt-5-mini": {
    input: 0.25,
    output: 2.0,
    cacheRead: 0.025,
    cacheWrite: 0,
    confidence: "confirmed",
  },
  // Google bills cache storage by time, not by token, and this workload never
  // holds an explicit cache, so cache writes are zero.
  "google/gemini-3.5-flash-lite": {
    input: 0.3,
    output: 2.5,
    cacheRead: 0.03,
    cacheWrite: 0,
    confidence: "confirmed",
  },
} as const satisfies Record<string, ModelSpec>;

export type ModelId = keyof typeof MODELS;

/** Every id, in dropdown order. */
export const MODEL_IDS = Object.keys(MODELS) as ModelId[];

/**
 * What a person calls each model: the picker's option text and the
 * "ask … instead" button. Raw ids appear only where they are the point (the
 * trace, the measurements). Keyed by ModelId, so a model added to the
 * catalogue without a name is a type error rather than a blank option.
 */
export const MODEL_NAMES: Record<ModelId, string> = {
  "openai/gpt-6-luna": "GPT-6 Luna",
  "deepseek/deepseek-v4-flash-0731": "DeepSeek V4 Flash",
  "anthropic/claude-haiku-5.5": "Claude Haiku 5.5",
  "openai/gpt-5-mini": "GPT-5 mini",
  "google/gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
};

/** A model's name, or its id when it isn't one this catalogue knows. */
export function modelName(id: string): string {
  return (MODEL_NAMES as Record<string, string>)[id] ?? id;
}

/**
 * What an unknown or absent id resolves to. Must be `MODEL_IDS[0]`. Chosen in
 * docs/followups.md §2.
 */
export const DEFAULT_MODEL: ModelId = "openai/gpt-6-luna";

/**
 * The reasoning level to send for one turn, or undefined to send none and leave
 * the provider on its default. The route's only way to read `reasoning`.
 */
export function reasoningFor(
  model: ModelId,
  turn: { jobPosting: boolean },
): ReasoningLevel | undefined {
  const setting = (MODELS[model] as ModelSpec).reasoning;
  return turn.jobPosting ? setting?.jobPosting : setting?.chat;
}

// --- What a visitor is allowed ---------------------------------------------
//
// Endpoint policy rather than a fact about any model, but it has three readers
// (the route enforces it, the status strip renders it, the system prompt
// describes it), so it is stated once, beside the catalogue it applies to.
// Anything that phrases these for a person must read them from here.

/**
 * Turns per visitor per sliding hour. One bucket covers every model: no model
 * in the catalogue costs enough more than the others to need its own.
 */
export const HOURLY_LIMIT = 20;

/**
 * Visitor messages one conversation allows before the route returns its
 * rate-limited state. The body schema's 30-message cap is deliberately looser
 * so that exceeding this reaches the graceful 429 rather than a schema 400.
 */
export const MAX_USER_MESSAGES = 10;
