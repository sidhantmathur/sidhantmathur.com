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
// expensive model on a small bucket. Delete the premium entry to turn the whole
// tier off; nothing else needs to change.
//
// This workload is input-dominated — the system prompt plus knowledge base is
// ~4k tokens on every turn against ~300 tokens of answer — so input price is
// what actually bills. Sonnet was the first premium entry at $3/$15 and was not
// worth 3x Luna here; Luna held the slot until its short-context price dropped
// to $0.20/$1.20, at which point it moved to `standard` as a workhorse and
// haiku 4.5 — now the most expensive input price in this table at $1/1M —
// took the small bucket. The premium tier is a cost boundary, not a quality
// badge: it holds whichever model bills most per turn.
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
// RE-CHECKED 2026-08-12, when the catalogue was rebuilt around the cheap
// models. What that check found, per row, is in the comments below. The short
// version:
//   * deepseek-v4-flash was superseded upstream by DeepSeek-V4-Flash-0731,
//     which the Gateway lists as its own id at $0.09/$0.18 — the pair the old
//     row wrongly carried before the 2026-07-27 correction is now simply true
//     of the new snapshot. Its cache-hit rate is not published yet, so that
//     figure went from published back to derived.
//   * gpt-5.6-luna is finally priced on its Gateway page: $0.20/$1.20 with a
//     published $0.02 cached-input rate for short-context requests (a long-
//     context tier exists at $1.00/$6.00; every turn here is ~4k tokens, far
//     under any breakpoint). Previously the least trustworthy row; now
//     confirmed, and cheap enough to be a standard-tier workhorse.
//   * haiku 4.5 ($1.00/$5.00), gpt-5-mini ($0.25/$2.00) and
//     gemini-3.5-flash-lite ($0.30/$2.50) re-confirmed unchanged; their cache
//     rates keep the same status as before (haiku's multipliers published,
//     the other two derived).
//
// Nothing on /measurements is denominated in money, deliberately, so no
// published aggregate depends on any of these.

/** When the `input`/`output` prices below were last checked against the Gateway. */
export const PRICES_CHECKED = "2026-08-12";

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
  // The default and first workhorse. DeepSeek retired deepseek-v4-flash in
  // favour of this 0731 snapshot, which the Gateway lists as its own id.
  // Input/output confirmed 2026-08-12 at $0.09/$0.18. The cache-hit rate is
  // not published for this snapshot, so it is DERIVED: the old snapshot's
  // published hit/miss ratio (0.0028 / 0.14 = 0.02x) applied to the new input
  // price. That ratio flips this row's confidence from confirmed to derived —
  // the honest label until DeepSeek publishes the hit rate.
  "deepseek/deepseek-v4-flash-0731": {
    tier: "standard",
    input: 0.09,
    output: 0.18,
    cacheRead: 0.0018,
    cacheWrite: 0,
    confidence: "derived",
  },
  // The second workhorse, ex-premium. OpenAI prices Luna's short- and long-
  // context requests separately; these are the short-context rates, confirmed
  // 2026-08-12 ($0.20/$1.20, cached input a published $0.02). Every turn here
  // is ~4k tokens of input, far under any long-context breakpoint, so the
  // long-context tier ($1.00/$6.00) never applies to this workload. Cache
  // writes are not billed.
  "openai/gpt-5.6-luna": {
    tier: "standard",
    input: 0.2,
    output: 1.2,
    cacheRead: 0.02,
    cacheWrite: 0,
    confidence: "confirmed",
  },
  // OpenAI: cached input is discounted to 0.1x; cache writes are not billed.
  // Input/output re-confirmed 2026-08-12; the cache rate is still derived.
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
  // Input/output re-confirmed 2026-08-12; the cache rate is still derived.
  "google/gemini-3.5-flash-lite": {
    tier: "standard",
    input: 0.3,
    output: 2.5,
    cacheRead: 0.075,
    cacheWrite: 0,
    confidence: "derived",
  },
  // Anthropic: cache reads bill at 0.1x input, 5-minute cache writes at 1.25x.
  // Re-confirmed 2026-08-12: $1.00/$5.00 per 1M, both multipliers published.
  // Premium because on this input-dominated workload $1/1M input bills 5-11x
  // the standard rows per turn — the tier is a cost boundary, not a ranking.
  "anthropic/claude-haiku-4.5": {
    tier: "premium",
    input: 1.0,
    output: 5.0,
    cacheRead: 0.1,
    cacheWrite: 1.25,
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
