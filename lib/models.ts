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
// Each tier has its own rate-limit bucket — `TIER_LIMITS`, below. It lived in
// the route while the route was its only reader; the chat's own prompt now
// states the allowance too, so it lives here with the tier it describes and
// both files read it. The point is that the budget is visible in the UI,
// showing the cost engineering rather than hiding it. `standard` is cheap-tier models only; `premium` is one substantially more
// expensive model on a small bucket. Turning the tier off is more than
// deleting its row: the static suite expects exactly one premium model, and
// the system prompt tells visitors the premium allowance in words.
//
// This workload is input-dominated — the bake-off measured a median of 6k to
// 12k input tokens a turn against a few hundred of answer — so input price is
// what actually bills. Sonnet was the first premium entry at $3/$15 and was not
// worth 3x Luna here; Luna held the slot until its price dropped, then haiku
// 4.5 at $1/1M input held it until its successor came in at a tenth of that.
// The premium tier is a cost boundary, not a quality badge: it holds whichever
// model bills most per turn — which, since 2026-10-19, is not by much. See the
// last row.
//
// --- The prices ------------------------------------------------------------
//
// HONESTY, because this is a site about instrumentation being honest:
//
//   * These are LIST prices, per 1M tokens, as published on the Vercel AI
//     Gateway model list and checked on `PRICES_CHECKED` below. They are what
//     the meter estimates with. They are not an invoice.
//   * Cache rates are the Gateway's published figures where it publishes one.
//     Where it doesn't, the rate is DERIVED from the provider's published
//     discount, the row is labelled `derived`, and its comment says so.
//   * `confidence` says how far a row is to be trusted, as data rather than as
//     a comment, because a comment cannot be rendered and `/measurements/models`
//     prints these numbers. A page that prints a dollar figure without saying
//     which of its prices could not be confirmed is doing the thing this whole
//     site argues against, so the caveat travels with the number.
//
// Anything rendering these must label the result as an estimate at list price.
//
// RE-CHECKED 2026-10-19 against the Gateway's own list,
// https://ai-gateway.vercel.sh/v1/models, and its per-provider breakdown at
// /v1/models/{id}/endpoints. Every rate below is published there, cache rates
// included. What changed since 2026-08-12:
//   * claude-haiku-4.5 → claude-haiku-5.5, its successor: $1.00/$5.00 →
//     $0.10/$0.50. Haiku 4.5 is still served; this site no longer offers it.
//   * gpt-5.6-luna → gpt-6-luna, its successor: $0.20/$1.20 → $0.10/$0.50.
//   * deepseek-v4-flash-0731 repriced, $0.09/$0.18 → $0.076/$0.153, and its
//     cache rate is published now ($0.014; the derived $0.0018 was 8x low).
//     Kept rather than swapped for deepseek-v4.1-flash, and now unconfirmed —
//     both for reasons on its row.
//   * gemini-3.5-flash-lite's cache rate is published at $0.03; the derived
//     $0.075 was 2.5x high. Input/output unchanged.
//   * gpt-5-mini unchanged, its $0.025 cache rate now published.
// No row is deprecated on the Gateway.
//
// Published bake-off costs were computed at the prices on record when each run
// was published and are not recomputed here — see /measurements/models.

/** When the `input`/`output` prices below were last checked against the Gateway. */
export const PRICES_CHECKED = "2026-10-19";

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
 *   unconfirmed — no checked rate can be said to apply to a turn: either none
 *               was published, or several are and the meter cannot see which
 *               one billed. Least trustworthy row here; its comment says which.
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

// Order is the dropdown order, cheapest first, and the first entry is what the
// shell selects on load — so it must be the same model as DEFAULT_MODEL below.
export const MODELS = {
  // The default and first workhorse. The Gateway serves this snapshot through
  // fifteen providers whose rates run from $0.02 to $0.44 input and $0.15 to
  // $1.32 output; these figures are its headline, which is the cheapest
  // provider's. The route does not pin a provider and the meter cannot see
  // which one a turn billed at, so the price is UNCONFIRMED for any given
  // turn, and could be several times low.
  //
  // deepseek-v4.1-flash is the newer version, and DeepSeek's own endpoint on
  // the Gateway serves that rather than this snapshot. It is not swapped in
  // because its first-party rate doubles in weekday peak windows, which a
  // list-price meter cannot state honestly either — and because this is the
  // default, so the swap is a decision rather than a refresh.
  "deepseek/deepseek-v4-flash-0731": {
    tier: "standard",
    input: 0.076,
    output: 0.153,
    cacheRead: 0.014,
    cacheWrite: 0,
    confidence: "unconfirmed",
  },
  // Successor to gpt-5.6-luna. Short-context rates; the long-context tier
  // starts at 272k tokens, far past any turn here. Every provider the Gateway
  // routes to (OpenAI, Azure, Bedrock) bills the same.
  "openai/gpt-6-luna": {
    tier: "standard",
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
    confidence: "confirmed",
  },
  // Successor to claude-haiku-4.5, at a tenth of its price. These are the
  // rates for prompts up to 100k tokens ($0.50/$2.50 beyond); a turn here is
  // nowhere near. Cache writes are the 5-minute rate. Unlike 4.5 it thinks by
  // default, and thinking bills as output.
  "anthropic/claude-haiku-5.5": {
    tier: "standard",
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
    confidence: "confirmed",
  },
  // OpenAI doesn't bill cache writes. Azure's cached rate is $0.03 against
  // OpenAI's $0.025; the meter uses OpenAI's.
  "openai/gpt-5-mini": {
    tier: "standard",
    input: 0.25,
    output: 2.0,
    cacheRead: 0.025,
    cacheWrite: 0,
    confidence: "confirmed",
  },
  // Google bills cache storage by time, not by token, and this workload never
  // holds an explicit cache, so cache writes are zero.
  //
  // Premium because the rule above says the priciest row takes the small
  // bucket, and at $0.30/$2.50 this is it — by 1.2x over gpt-5-mini, where
  // Haiku 4.5's input price was more than 3x the next row's. A 5/hour bucket
  // on a model that costs what the 20/hour ones cost is the rule outliving its
  // reason; whether the tier stays is open in docs/followups.md §2.
  "google/gemini-3.5-flash-lite": {
    tier: "premium",
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

/** What an unknown or absent id resolves to. Must be `MODEL_IDS[0]`. */
export const DEFAULT_MODEL: ModelId = "deepseek/deepseek-v4-flash-0731";

// --- What a visitor is allowed ---------------------------------------------
//
// Endpoint policy rather than a fact about any model, but it has three readers
// now — the route enforces it, the status strip renders it, and the system
// prompt tells the visitor about it in words — so it is stated once, here,
// beside the tiers it is indexed by.
//
// Anything that phrases these for a human must read them from here. A number
// retyped into prose is a number that goes stale silently.

/** Turns an hour each tier's bucket buys, on a sliding one-hour window. */
export const TIER_LIMITS: Record<Tier, number> = {
  standard: 20,
  premium: 5,
};

/**
 * Visitor messages one conversation allows before the route returns its
 * rate-limited state. The body schema's 30-message cap is deliberately looser
 * so that exceeding this reaches the graceful 429 rather than a schema 400.
 */
export const MAX_USER_MESSAGES = 10;
