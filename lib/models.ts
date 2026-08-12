// The model catalogue — one row per model, and the only place any of it is said.
//
// This used to be four lists: the server allowlist in `app/api/chat/route.ts`,
// the dropdown's array in `components/shell/app-shell.tsx`, the price and
// confidence tables in `lib/pricing.ts`, and the bake-off's list in
// `scripts/run-bakeoff.mjs`. Two of them were kept in step by a regex that
// scraped the other two files' source text, which is a strange way to compare
// two constants that could simply have been one. They are one now.
//
// Why the drift mattered: the route resolves an unknown id to the default
// rather than erroring, so a dropdown offering a model the server had dropped
// produced no error anywhere — just a visitor who picked a model and quietly
// got a different one.
//
// --- The allowlist ---------------------------------------------------------
//
// The client picks a model, so this is a security AND a cost boundary: the id
// from the request is never passed through to the Gateway, only used to look up
// an entry here.
//
// Each tier has its own rate-limit bucket (`TIER_LIMITS` in the route — that is
// policy about that endpoint, not a fact about a model). The point is that the
// budget is visible in the UI, showing the cost engineering rather than hiding
// it. `standard` is cheap-tier models only; `premium` is one substantially more
// expensive model on a small bucket. Delete the premium entry to turn the whole
// tier off; nothing else needs to change.
//
// This workload is input-dominated — the system prompt plus knowledge base is
// ~4k tokens on every turn against ~300 tokens of answer — so input price is
// what actually bills. Sonnet was the previous premium entry at $3/$15 and was
// not worth 3x Luna here.
//
// --- The prices ------------------------------------------------------------
//
// HONESTY, because this is a site about instrumentation being honest:
//
//   * These are LIST prices, per 1M tokens, as published on the Vercel AI
//     Gateway model list and checked on `PRICES_CHECKED` below. They are what
//     the meter estimates with. They are not an invoice.
//   * `input` and `output` are the two numbers to trust.
//   * `cacheRead` and `cacheWrite` are mostly DERIVED — each provider's
//     published discount/surcharge applied to that model's input price, rather
//     than a separately checked figure. Where a provider publishes the cached
//     rate directly it is used as published and the comment says so.
//   * `confidence` says which of those a row is, as data rather than as a
//     comment, because a comment cannot be rendered and `/measurements/models`
//     prints these numbers. A page that prints a dollar figure without saying
//     which of its prices could not be confirmed is doing the thing this whole
//     site argues against, so the caveat travels with the number.
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
//     derived figures the soft numbers; the check found the supposedly-solid
//     ones were the problem on this row.
//   * gpt-5.6-luna could not be confirmed and is marked as such.
//
// Nothing on /measurements is denominated in money, deliberately, so no
// published aggregate depends on any of these.

/** When the `input`/`output` prices below were last checked against the Gateway. */
export const PRICES_CHECKED = "2026-07-27";

/**
 * Which tier's hourly budget a turn spends from. Declared rather than derived
 * from the table so that emptying a tier out is a one-line edit that still
 * compiles.
 */
export type Tier = "standard" | "premium";

/**
 *   confirmed — input and output checked against a published rate on PRICES_CHECKED
 *   derived   — input/output confirmed; the cache rate is a published multiplier
 *               applied to input rather than a separately published figure
 *   unconfirmed — neither could be checked. Least trustworthy row here.
 */
export type PriceConfidence = "confirmed" | "derived" | "unconfirmed";

/** One model. Prices are dollars per 1M tokens. */
export type ModelSpec = {
  tier: Tier;
  input: number;
  output: number;
  /** Input tokens served from the provider's prompt cache. */
  cacheRead: number;
  /** Input tokens written into the cache. Zero where the provider doesn't bill it. */
  cacheWrite: number;
  confidence: PriceConfidence;
};

// Order is the dropdown order, and the first entry is what the shell selects on
// load — so it must be the same model as DEFAULT_MODEL below.
export const MODELS = {
  // Anthropic: cache reads bill at 0.1x input, 5-minute cache writes at 1.25x.
  // Verified 2026-07-27: $1.00/$5.00 per 1M, and both multipliers are published.
  "anthropic/claude-haiku-4.5": {
    tier: "standard",
    input: 1.0,
    output: 5.0,
    cacheRead: 0.1,
    cacheWrite: 1.25,
    confidence: "confirmed",
  },
  // OpenAI: cached input is discounted to 0.1x; cache writes are not billed.
  // Input/output confirmed 2026-07-27; the cache rate is still derived.
  "openai/gpt-5-mini": {
    tier: "standard",
    input: 0.25,
    output: 2.0,
    cacheRead: 0.025,
    cacheWrite: 0,
    confidence: "derived",
  },
  // Google: cached input is discounted to 0.25x; storage is billed by time, not
  // by token, and this workload never holds an explicit cache, so it's zero.
  // Input/output confirmed 2026-07-27; the cache rate is still derived.
  "google/gemini-3.5-flash-lite": {
    tier: "standard",
    input: 0.3,
    output: 2.5,
    cacheRead: 0.075,
    cacheWrite: 0,
    confidence: "derived",
  },
  // DeepSeek publishes the cache-hit rate directly rather than as a multiplier,
  // and it is ~50x below a miss, not the ~10x this row previously assumed.
  // Corrected 2026-07-27: input was 0.09 (published 0.14), output was 0.18
  // (published 0.28), and cacheRead was a derived 0.009 against a published
  // 0.0028. This is the one row here whose cache read is NOT derived.
  //
  // The route's allowlist carried $0.09/$0.18 in a comment until this table was
  // merged — the pre-correction pair, left behind because a comment is not
  // something a test can check. It is gone rather than reinstated: these are
  // the numbers the meter has been billing against since the re-check.
  "deepseek/deepseek-v4-flash": {
    tier: "standard",
    input: 0.14,
    output: 0.28,
    cacheRead: 0.0028,
    cacheWrite: 0,
    confidence: "confirmed",
  },
  // UNCONFIRMED as of 2026-07-27 — neither the input/output pair nor the cache
  // discount could be checked against a published rate. Treat as the least
  // trustworthy row here.
  "openai/gpt-5.6-luna": {
    tier: "premium",
    input: 1.0,
    output: 6.0,
    cacheRead: 0.1,
    cacheWrite: 0,
    confidence: "unconfirmed",
  },
} as const satisfies Record<string, ModelSpec>;

export type ModelId = keyof typeof MODELS;

/** Every id, in dropdown order. */
export const MODEL_IDS = Object.keys(MODELS) as ModelId[];

/** What an unknown or absent id resolves to. Must be `MODEL_IDS[0]`. */
export const DEFAULT_MODEL: ModelId = "anthropic/claude-haiku-4.5";
