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
//
// --- Per-model settings ------------------------------------------------------
//
// A row can carry three settings, each absent by default and each read by the
// route through one helper, so nothing picks a value behind the catalogue's
// back:
//
//   reasoning        how hard the model thinks, by kind of turn   reasoningFor
//   maxOutputTokens  the output ceiling per step, by kind of turn maxOutputTokensFor
//                    (DEFAULT_MAX_OUTPUT_TOKENS when absent)
//   gateway          which Gateway providers may serve it         providerOptionsFor
//
// The comment above each row says what it sets and why. GPT-6 Luna's posting
// reasoning was measured before it was applied (2026-10-19). Everything applied
// on 2026-11-02 (Haiku's reasoning and ceiling, GPT-5 mini's reasoning,
// DeepSeek's provider pin) comes from the 2026-10-19 smoke test and the
// 2026-10-20 bake-off, and NONE of it has run live yet. The next live smoke
// test has to confirm each one; the checklist is in docs/followups.md §2,
// "Applied 2026-11-02, untested".
//
// Provider routing, `order` against `only` (the Gateway's docs on provider
// order and provider only, checked 2026-11-02). `order` only reorders: the Gateway tries
// the listed providers first, and any provider not listed can still serve the
// request as a fallback after them. `only` is a filter: the request goes to the
// listed providers and nowhere else, and fails if every one of them fails.
//
// DeepSeek uses `only`. The meter prices a turn at the catalogue's rate, which
// is one provider's, runware's. Under `order` a fallback could bill up to about
// six times that (novita and streamlake list $0.44/$1.32) and the meter could
// not see it, which is how the 2026-10-20 bake-off came to bill 3.3 times list.
// Under `only` a runware outage fails a DeepSeek turn instead, visibly, and the
// shell's error offers the same question to another model. DeepSeek is not the
// default, so an outage reaches only visitors who picked it, while a meter that
// reads low reaches every number /measurements publishes about it. The
// catalogue put runware's uptime at 99.92% over the day to 2026-11-02.

/** When the `input`/`output` prices below were last checked against the Gateway. */
export const PRICES_CHECKED = "2026-11-02";

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
 *
 * Each model accepts its own subset, listed as `reasoning_options` on the
 * Gateway's public /v1/models; evals/static.test.mjs holds every row to the
 * subset on record there.
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
 * has a small output ceiling a thinking model can exhaust before saying a word,
 * while a job-posting turn has room but runs three steps, so hidden reasoning
 * is most of the wait.
 */
export type ReasoningSetting = {
  /** Every turn that is not a pasted job posting. */
  chat?: ReasoningLevel;
  /** A pasted job posting: extract, judge, then the sentence after. */
  jobPosting?: ReasoningLevel;
};

/** Output tokens allowed per step, by kind of turn; absent keys take the default. */
export type OutputCeiling = {
  chat?: number;
  jobPosting?: number;
};

/**
 * Which Gateway providers may serve a model, passed as
 * `providerOptions.gateway`. Provider slugs are the `provider_name` values on
 * the Gateway's /v1/models/{id}/endpoints. See the header for `order` against
 * `only`.
 */
export type GatewayRouting = {
  /** Serve only from these; fail if all of them fail. */
  only?: readonly string[];
  /** Try these first, in order; others may still serve as fallbacks. */
  order?: readonly string[];
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
  /** Optional. Absent means DEFAULT_MAX_OUTPUT_TOKENS on every turn. */
  maxOutputTokens?: OutputCeiling;
  /** Optional. Absent means the Gateway routes the model however it likes. */
  gateway?: GatewayRouting;
  /**
   * When this row's reasoning, ceiling or routing last changed (ISO date). A
   * published run from before it measured the earlier settings, and
   * /measurements/models says so rather than describing these as what it ran.
   */
  settingsChanged?: string;
};

// --- Per-step output ceiling -------------------------------------------------
//
// Moved here from the route on 2026-11-02 so a row can override it. It applies
// to every step of a turn, not to the turn as a whole.
//
// 600 tokens suits a conversational answer. A job-posting turn has to fit an
// extraction, a whole `roleFit` object and the sentence after it, and a turn
// truncated mid-tool-call loses the tool call entirely. An ordinary turn that
// calls `roleFit` (the RevOps chip) needs room too: the call alone took 360–450
// tokens on the models that completed one in the 2026-10-19 smoke test, so a
// model that writes a sentence first can run out at 600.
//
// The posting ceiling comes from measurement: a reasoning model spends the
// per-step budget on reasoning before it emits the tool call. At 1000,
// `openai/gpt-5-mini` finished three of five postings on
// `finishReason: "length"` with nothing to show; at 2500 it spent 2,496 tokens
// reasoning on the extraction step alone and emitted nothing. It's a ceiling,
// not a target: non-reasoning models still answer in about 500.
//
// Nothing else reads this number: the system prompt (published at /prompt)
// doesn't state it, and the cost meter prices the tokens a turn used, not the
// ceiling.
export const DEFAULT_MAX_OUTPUT_TOKENS = { chat: 600, jobPosting: 4000 } as const;

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
    settingsChanged: "2026-10-19",
  },
  // Fourteen providers serve this snapshot (Gateway catalogue, 2026-11-02), at
  // $0.04–$0.44 input and $0.14–$1.32 output. These are runware's rates, the
  // Gateway's headline, and `only: ["runware"]` pins every turn there so the
  // meter prices the provider that billed (the header says why `only`). Still
  // `unconfirmed` until a live smoke test shows the pin holding: every turn's
  // `providerMetadata.gateway.routing.finalProvider` is runware and the
  // Gateway's own cost matches the meter. Unpinned, all ten smoke-test turns
  // (2026-10-19) went to runware, and the bake-off the next day was billed 3.3
  // times list. The newer deepseek-v4.1-flash isn't a fix: its first-party rate
  // doubles at weekday peak. Reasoning stays at the provider default, which can
  // spend a turn's whole ceiling thinking; at `none` it fixed the chips but
  // wrote raw tool-call markup into the answer on a posting turn.
  "deepseek/deepseek-v4-flash-0731": {
    input: 0.076,
    output: 0.153,
    cacheRead: 0.014,
    cacheWrite: 0,
    confidence: "unconfirmed",
    gateway: { only: ["runware"] },
    settingsChanged: "2026-11-02",
  },
  // Rates for prompts up to 100k tokens ($0.50/$2.50 beyond); a turn here is
  // nowhere near. Cache writes are the 5-minute rate. It thinks by default, and
  // thinking bills as output: on the RevOps chip it spent 599 of 600 tokens
  // thinking and rendered nothing. With reasoning off (2026-10-19 smoke test)
  // it produced the fastest complete posting card (16 s) and three clean chips
  // of four. The fourth lost its `roleFit` call to the 600-token ceiling after
  // a one-line preamble, so ordinary turns get 1,000. Postings keep 4,000.
  "anthropic/claude-haiku-5.5": {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
    confidence: "confirmed",
    reasoning: { chat: "none", jobPosting: "none" },
    maxOutputTokens: { chat: 1000 },
    settingsChanged: "2026-11-02",
  },
  // OpenAI doesn't bill cache writes. Azure's cached rate is $0.03 against
  // OpenAI's $0.025; the meter uses OpenAI's. At its default effort it spent
  // the whole ceiling reasoning on two of four chips, and the posting took 72 s
  // and produced no card. The Gateway lists its efforts as minimal, low, medium
  // and high, with no `none`, so ordinary turns get the floor, `minimal`, and
  // postings get `low`, the level that halved GPT-6 Luna's posting wait.
  // Dropping the model instead is Sidhant's call.
  "openai/gpt-5-mini": {
    input: 0.25,
    output: 2.0,
    cacheRead: 0.025,
    cacheWrite: 0,
    confidence: "confirmed",
    reasoning: { chat: "minimal", jobPosting: "low" },
    settingsChanged: "2026-11-02",
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

/**
 * When a model's per-model settings last changed, or undefined if it has none.
 * A published run from before this date measured the settings before it.
 */
export function settingsChangedOn(model: ModelId): string | undefined {
  return (MODELS[model] as ModelSpec).settingsChanged;
}

/**
 * The output ceiling per step for one turn: the row's own, or the default for
 * that kind of turn. The route's only way to read `maxOutputTokens`.
 */
export function maxOutputTokensFor(model: ModelId, turn: { jobPosting: boolean }): number {
  const ceiling = (MODELS[model] as ModelSpec).maxOutputTokens;
  return turn.jobPosting
    ? (ceiling?.jobPosting ?? DEFAULT_MAX_OUTPUT_TOKENS.jobPosting)
    : (ceiling?.chat ?? DEFAULT_MAX_OUTPUT_TOKENS.chat);
}

/**
 * The call-level `providerOptions` for one model's turns, or undefined to send
 * none and let the Gateway route as it likes. The route's only way to read
 * `gateway`. Copies the lists, because the SDK's option type wants mutable
 * arrays and the catalogue's are read-only.
 */
export function providerOptionsFor(
  model: ModelId,
): { gateway: { only?: string[]; order?: string[] } } | undefined {
  const routing = (MODELS[model] as ModelSpec).gateway;
  if (!routing) return undefined;
  return {
    gateway: {
      ...(routing.only ? { only: [...routing.only] } : {}),
      ...(routing.order ? { order: [...routing.order] } : {}),
    },
  };
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
