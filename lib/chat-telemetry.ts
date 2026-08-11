// The per-turn telemetry channel (roadmap Sprint 1, F1).
//
// Before this, the only thing the chat route told the client beyond the answer
// itself was four HTTP response headers — model, tier, and the remaining budget.
// Everything the instruments in Sprint 2 need (what a turn cost, how fast the
// first token arrived, whether the prompt cache hit, how many steps ran, and
// what KIND of failure a failure was) was measured on the server and thrown
// away. This module is the shared vocabulary for that data, imported by both
// `app/api/chat/route.ts` and the client shell so the shape can't drift.
//
// The transport is a single AI SDK data part per turn, written twice: once at
// request start with what's already known, once at the end with the numbers.
// Both writes carry the same part id, so the SDK reconciles them into ONE part
// on the assistant message rather than appending two. That also means the
// record is persisted with the conversation and survives a reload, which the
// alternative (a `transient: true` part, delivered to `onData` and never
// stored) would not.
//
// Data parts are dropped by `convertToModelMessages`, so a record echoed back
// as history on the next request never reaches the model or bills a token.

import type { UIMessage } from "ai";

/** The part id both writes share. Reconciliation is keyed on it. */
export const TURN_PART_ID = "turn";

// --- Error classes --------------------------------------------------------
//
// #6 (failure theatre) needs failures to be a small, closed set it can render
// deliberately, not an error string it has to pattern-match. Every path out of
// the route — the early JSON errors and mid-stream failures alike — resolves to
// one of these, and the client's error state is derived from the class rather
// than from message text.

// EVERYTHING about a class lives in the one table below, and the type is
// derived FROM it. That direction is the point. This set used to be a fact
// restated in five hand-kept places — the union, a runtime array that
// duplicated the union, two `Partial<Record<>>` copy maps that fell back
// silently when an entry was missing, the route's simulate list, and a prose
// mirror in the instrument deck — and the copies had already drifted apart.
// With one table, every downstream map is exhaustive by construction: a class
// added here without a sentence is a type error, not a silent fallback.

export type FailureSpec = {
  /**
   * Where the class is raised. `server` classes come out of app/api/chat/route.ts
   * and can be reproduced there on demand; a `client` class never reaches the
   * route at all, which is why the route's simulate list and the instrument
   * deck's button list both filter on this field rather than restating a list.
   */
  origin: "client" | "server";
  /** Whether `?simulate=<class>` on the chat route will reproduce it. */
  simulatable: boolean;
  /** The status of the early JSON exit, or null for a mid-stream failure. */
  simulateStatus: number | null;
  /** Whether "try again" belongs under the sentence. See `isRetryableClass`. */
  retryable: boolean;
  /** Whether the site renders nothing at all. See `isSilentClass`. */
  silent: boolean;
  /** Whether this is "you've hit the cap" rather than "broken". */
  rateLimit: boolean;
  /** Short label above the sentence, or null to fall back to the class id. */
  label: string | null;
  /** The sentence the reader is shown, or null to fall back to `unknown`'s. */
  copy: string | null;
  /** What actually causes it in production. Instrument deck prose. */
  cause: string | null;
  /** How it reaches the client. Instrument deck prose. */
  wire: string | null;
};

/**
 * The whole vocabulary. Order is meaningful: the route's simulate list and the
 * failure-theatre deck are this table filtered, in this order, so the early
 * exits (a status code) come before the mid-stream ones (an HTTP 200 whose
 * stream ends in an error chunk) — a client that only checked `res.ok` would
 * call the second kind a success, and the deck reads top to bottom.
 *
 * On the two null `copy` entries. `rate_limited` is not an error state, it is
 * the budget running out, and it routes to ManualMode instead. `aborted` is the
 * reader pressing stop — telling someone what they just did is not information.
 * Both are written as an explicit null rather than an absent key so that adding
 * a class still forces the question.
 */
export const TURN_FAILURES = {
  invalid_request: {
    origin: "server",
    simulatable: true,
    simulateStatus: 400,
    retryable: false,
    silent: false,
    rateLimit: false,
    label: "bad request",
    copy: "That message couldn't be sent as written. Try shortening it.",
    cause: "The request body failed schema validation — a bad client, not a bad model.",
    wire: "400, JSON body",
  },
  rate_limited: {
    origin: "server",
    simulatable: true,
    simulateStatus: 429,
    retryable: true,
    silent: false,
    rateLimit: true,
    label: null,
    copy: null,
    cause: "The hourly per-tier budget is spent, or the conversation passed ten turns.",
    wire: "429, JSON body",
  },
  upstream_unconfigured: {
    origin: "server",
    simulatable: true,
    simulateStatus: 502,
    retryable: true,
    silent: false,
    rateLimit: false,
    label: "misconfigured",
    copy: "The chat backend is misconfigured — this one is on me, not you.",
    cause: "No gateway key on the server. A deploy problem, checked before the model is called.",
    wire: "502, JSON body",
  },
  upstream_auth: {
    origin: "server",
    simulatable: true,
    simulateStatus: null,
    retryable: true,
    silent: false,
    rateLimit: false,
    label: "misconfigured",
    copy: "The chat backend is misconfigured — this one is on me, not you.",
    cause:
      "The gateway rejected our credentials. It surfaces mid-stream, which is why the key is checked up front.",
    wire: "200, error chunk",
  },
  upstream_timeout: {
    origin: "server",
    simulatable: true,
    simulateStatus: null,
    retryable: true,
    silent: false,
    rateLimit: false,
    label: "server timeout",
    copy: "The server stopped responding partway through. Give it another try.",
    cause: "The model took too long, or the connection dropped part-way through an answer.",
    wire: "200, error chunk",
  },
  upstream_unavailable: {
    origin: "server",
    simulatable: true,
    simulateStatus: null,
    retryable: true,
    silent: false,
    rateLimit: false,
    label: "upstream",
    copy: "Something went wrong on my end. Give it another try in a moment.",
    cause: "The gateway or the model itself failed.",
    wire: "200, error chunk",
  },
  /**
   * Client-detected connection failure — the request never reached the server,
   * or the socket died on the way back. THE SERVER NEVER EMITS THIS ONE: it is
   * raised in the browser's fetch wrapper (see `chatFetch` in chat-transport.ts),
   * because a turn that dies on the network never gets far enough for the route
   * to have an opinion about it. That is what `origin: "client"` records, and it
   * is why this entry has no wire description: there is no server exit to
   * describe, and no button in the deck that could take one.
   */
  network: {
    origin: "client",
    simulatable: false,
    simulateStatus: null,
    retryable: true,
    silent: false,
    rateLimit: false,
    label: "connection",
    copy: "The connection dropped before the answer made it through. Check your signal and try again.",
    cause: null,
    wire: null,
  },
  aborted: {
    origin: "server",
    simulatable: true,
    simulateStatus: null,
    retryable: true,
    silent: true,
    rateLimit: false,
    label: null,
    copy: null,
    cause: "The reader navigated away or hit stop. Not a failure to report as one.",
    wire: "200, error chunk",
  },
  unknown: {
    origin: "server",
    simulatable: true,
    simulateStatus: null,
    retryable: true,
    silent: false,
    rateLimit: false,
    label: "unknown",
    copy: "Something went wrong on my end. Give it another try in a moment.",
    cause: "Classification fell through. Always worth reading the server log for.",
    wire: "200, error chunk",
  },
} as const satisfies Record<string, FailureSpec>;

export type TurnErrorClass = keyof typeof TURN_FAILURES;

/** Every class, in table order. */
export const TURN_ERROR_CLASSES = Object.keys(TURN_FAILURES) as TurnErrorClass[];

/** The classes `?simulate=` will reproduce, in table order. */
export const SIMULATABLE_CLASSES: TurnErrorClass[] = TURN_ERROR_CLASSES.filter(
  (cls) => TURN_FAILURES[cls].simulatable,
);

export type TurnError = {
  class: TurnErrorClass;
  /** Short, safe-to-display detail. Never a stack trace. */
  detail: string;
};

// --- The record -----------------------------------------------------------

export type TurnUsage = {
  /** Total input tokens, cached and uncached. */
  inputTokens: number | null;
  /** Input tokens served from the prompt cache — the cheap ones. */
  cachedInputTokens: number | null;
  /** Input tokens written INTO the cache. Priced above a normal input token. */
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type TurnTiming = {
  /**
   * Time to the model's first output chunk, measured by the SDK on the server.
   * This is model latency with the network to the browser excluded — a
   * different and more honest number than the client's send-to-first-paint
   * stopwatch, which is what the status strip has always shown.
   */
  ttftMs: number | null;
  /** Wall-clock time the route spent on this turn, start to last chunk. */
  durationMs: number | null;
  /** Output tokens per second across every step. */
  tokensPerSecond: number | null;
};

export type TurnTelemetry = {
  /** Which allowlisted model actually ran — not what the client asked for. */
  model: string;
  tier: string;
  budgetRemaining: number;
  budgetLimit: number;
  /** Whether the route classified this turn as a pasted job posting. */
  jobPosting: boolean;
  /**
   * Whether this turn carried the second corpus — the site's own source
   * (Sprint 7, #8). It is the only thing that changes the system prompt from
   * one turn to the next, so it is the one field that explains an input-token
   * count that doesn't look like the others, and the trace shows it.
   */
  siteQuestion: boolean;
  /** Null until the turn completes. */
  usage: TurnUsage | null;
  timing: TurnTiming | null;
  /** Model round-trips. >1 means a tool call was followed by a text answer. */
  steps: number | null;
  /** Tool names called this turn, in call order. */
  toolsCalled: string[] | null;
  finishReason: string | null;
  error: TurnError | null;
};

/** The data parts this app's UI messages can carry. */
export type ChatDataParts = {
  turn: TurnTelemetry;
};

/** The app's UIMessage type. Use everywhere a bare `UIMessage` was used. */
export type ChatUIMessage = UIMessage<never, ChatDataParts>;

// --- Classification -------------------------------------------------------

const ERROR_PATTERNS: [RegExp, TurnErrorClass][] = [
  [/\babort/i, "aborted"],
  [/\b(401|403)\b|unauthor|forbidden|invalid api key|api key/i, "upstream_auth"],
  [/timeout|timed out|etimedout|deadline/i, "upstream_timeout"],
  [/\b429\b|rate.?limit|quota/i, "rate_limited"],
];

/**
 * Maps an unknown thrown value to a class. Deliberately coarse: the point is a
 * stable, small set the UI can render, not a diagnosis. The full error is
 * logged server-side either way.
 */
export function classifyTurnError(err: unknown): TurnErrorClass {
  if (err instanceof Error && err.name === "AbortError") return "aborted";
  const text =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === "string"
        ? err
        : "";
  for (const [pattern, cls] of ERROR_PATTERNS) {
    if (pattern.test(text)) return cls;
  }
  return text ? "upstream_unavailable" : "unknown";
}

/** True for a class the site should show as "you've hit the cap", not "broken". */
export function isRateLimitClass(cls: TurnErrorClass): boolean {
  return TURN_FAILURES[cls].rateLimit;
}

/**
 * True for a class the site renders NOTHING for.
 *
 * `aborted` is the reader pressing stop, and the rule for that has always been
 * that the turn simply ends — no block, no apology, no button. A client-side
 * abort never reaches the error path at all (the SDK swallows it), but the
 * route can also CLASSIFY a turn as aborted and deliver that class over a live
 * stream, and that route used to land in the error block with the literal
 * label "aborted" over the generic "something went wrong on my end" copy: the
 * site telling a visitor it had failed at the thing they had just asked it to
 * stop doing. The rule is about the class, so the check is too.
 */
export function isSilentClass(cls: TurnErrorClass): boolean {
  return TURN_FAILURES[cls].silent;
}

/**
 * Whether "try again" belongs under the sentence for this class.
 *
 * Every class here is worth another attempt except one. `invalid_request` is
 * the route rejecting the body — a message too long for the schema is the only
 * way a visitor reaches it — and the retry affordance resends the SAME message,
 * so the button was an invitation to fail again identically. The copy already
 * says what to do instead ("try shortening it"), and the composer is right
 * there; a button that contradicts the sentence above it is worse than no
 * button.
 */
export function isRetryableClass(cls: TurnErrorClass): boolean {
  return TURN_FAILURES[cls].retryable;
}

/** Narrows an arbitrary string (an error message, a JSON error body) to a class. */
export function toTurnErrorClass(value: unknown): TurnErrorClass {
  return typeof value === "string" && Object.hasOwn(TURN_FAILURES, value)
    ? (value as TurnErrorClass)
    : "unknown";
}

// --- What the reader is told -----------------------------------------------
//
// One sentence per class, and the class is what picks it. The site used to show
// a single grey line for every failure, which is how a dropped connection on a
// phone read as "the model is broken" — the one reading that makes a visitor
// stop rather than try again. Each of these says what happened and what to do
// about it, and the two that are the site's own fault say so. The sentences
// live in the table above; these two functions are only the lookup.

/** The sentence for a class, falling back to the generic one. */
export function turnErrorCopy(cls: TurnErrorClass): string {
  return TURN_FAILURES[cls].copy ?? TURN_FAILURES.unknown.copy;
}

/**
 * The short label above the sentence — the site's own register for the class,
 * not the class id. Rendered as `turn failed · <label>`.
 *
 * `network` → "connection". Falls back to the class id, which is never wrong.
 */
export function turnErrorLabel(cls: TurnErrorClass): string {
  return TURN_FAILURES[cls].label ?? cls;
}
