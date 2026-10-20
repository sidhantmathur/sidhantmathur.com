// Every chat turn carries one telemetry record: what it cost, how fast the
// first token arrived, whether the prompt cache hit, how many steps ran, and
// what kind of failure a failure was. This module is its shared vocabulary,
// imported by both app/api/chat/route.ts and the client shell so the shape
// can't drift.
//
// The transport is one AI SDK data part per turn, written twice: at request
// start with what's already known, and at the end with the numbers. Both writes
// carry the same part id, so the SDK reconciles them into one part on the
// assistant message. Unlike a `transient: true` part, it is persisted with the
// conversation and survives a reload.
//
// Data parts are dropped by `convertToModelMessages`, so a record echoed back
// as history never reaches the model or bills a token.

import type { UIMessage } from "ai";

/** The part id both writes share. Reconciliation is keyed on it. */
export const TURN_PART_ID = "turn";

// --- Error classes --------------------------------------------------------
//
// Failures are a small, closed set the UI renders deliberately. Every path out
// of the route, early JSON errors and mid-stream failures alike, resolves to
// one of these, and the client's error state is derived from the class rather
// than from message text.
//
// Everything about a class lives in the one table below, and the type is
// derived from it, so every downstream map is exhaustive by construction: a
// class added without its fields is a type error, not a silent fallback.

export type FailureSpec = {
  /**
   * Where the class is raised. `server` classes come out of
   * app/api/chat/route.ts; a `client` class never reaches the route, so it
   * can't be `simulatable` (evals/instruments.test.mjs holds the two together).
   */
  origin: "client" | "server";
  /** Whether `?simulate=<class>` on the chat route will reproduce it. */
  simulatable: boolean;
  /** The status of the early JSON exit, or null for a mid-stream failure. */
  simulateStatus: number | null;
  /** Whether "try again" belongs under the sentence. See `isRetryableClass`. */
  retryable: boolean;
  /**
   * Whether asking a different model is a real way out: only where the failure
   * is the model's own behaviour. See `offersModelSwitch`.
   */
  switchModel: boolean;
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
 * instrument deck are this table filtered, in this order, so the early exits (a
 * status code) come before the mid-stream ones (an HTTP 200 whose stream ends
 * in an error chunk, which a client checking only `res.ok` would call a
 * success).
 *
 * Two entries have a null `copy`: `rate_limited` routes to ManualMode instead
 * of an error state, and `aborted` is the reader pressing stop. Explicit nulls
 * rather than absent keys, so adding a class still forces the question.
 */
export const TURN_FAILURES = {
  invalid_request: {
    origin: "server",
    simulatable: true,
    simulateStatus: 400,
    retryable: false,
    switchModel: false,
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
    switchModel: false,
    silent: false,
    rateLimit: true,
    label: null,
    copy: null,
    cause: "The hourly budget is spent, or the conversation passed ten turns.",
    wire: "429, JSON body",
  },
  upstream_unconfigured: {
    origin: "server",
    simulatable: true,
    simulateStatus: 502,
    retryable: true,
    switchModel: false,
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
    switchModel: false,
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
    switchModel: false,
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
    switchModel: false,
    silent: false,
    rateLimit: false,
    label: "upstream",
    copy: "Something went wrong on my end. Give it another try in a moment.",
    cause: "The gateway or the model itself failed.",
    wire: "200, error chunk",
  },
  /**
   * A turn that finished cleanly and said nothing: no text, and no tool output
   * with a surface of its own. Usually a reasoning model spending the whole
   * output ceiling thinking. The route marks the record with this class so it
   * isn't priced as an answer; the browser's transport (`answerWatcher` in
   * chat-transport.ts) is what fails the turn, since the route sends no error
   * chunk. Offers a different model because the same model on the same
   * question tends to run out of room the same way.
   */
  empty_answer: {
    origin: "server",
    simulatable: true,
    simulateStatus: null,
    retryable: true,
    switchModel: true,
    silent: false,
    rateLimit: false,
    label: "no answer",
    copy: "The model ran out of room before it got to an answer. That's a limit on my end, not a problem with your question.",
    cause:
      "A reasoning model spent its whole output budget thinking and finished with no text and no tool output.",
    wire: "200, finishes empty",
  },
  /**
   * Client-detected connection failure: the request never reached the server,
   * or the socket died on the way back. The server never emits this one; it is
   * raised in the browser's fetch wrapper (`guardedFetch` in
   * chat-transport.ts). Hence no wire description and no button in the deck.
   */
  network: {
    origin: "client",
    simulatable: false,
    simulateStatus: null,
    retryable: true,
    switchModel: false,
    silent: false,
    rateLimit: false,
    label: "connection",
    copy: "The connection dropped before the answer made it through. Check your signal and try again.",
    cause: null,
    wire: null,
  },
  /**
   * Client-detected on the way back into a saved conversation: it ends on a
   * question without a whole answer. The visitor left mid-answer (Home, or
   * the tab closed), or the turn failed and the failure, which isn't saved,
   * went with the page. Without this the question sits there with no answer,
   * or half of one, and no way to ask again.
   */
  interrupted: {
    origin: "client",
    simulatable: false,
    simulateStatus: null,
    retryable: true,
    switchModel: false,
    silent: false,
    rateLimit: false,
    label: "unfinished",
    copy: "This question never got a full answer — the conversation was left, or the turn failed, before it finished.",
    cause: null,
    wire: null,
  },
  aborted: {
    origin: "server",
    simulatable: true,
    simulateStatus: null,
    retryable: true,
    switchModel: false,
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
    switchModel: false,
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
  /** Input tokens written into the cache. Priced above a normal input token. */
  cacheWriteTokens: number | null;
  outputTokens: number | null;
  /**
   * The part of `outputTokens` the model spent thinking, which never reaches
   * the page. Optional because older persisted records don't carry it; null
   * when the provider doesn't report it.
   */
  reasoningTokens?: number | null;
  totalTokens: number | null;
};

export type TurnTiming = {
  /**
   * Time to the model's first output chunk, measured on the server: model
   * latency without the network to the browser, unlike a client-side
   * send-to-first-paint stopwatch.
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
  budgetRemaining: number;
  budgetLimit: number;
  /** Whether the route classified this turn as a pasted job posting. */
  jobPosting: boolean;
  /**
   * Whether this turn carried the second corpus, the site's own source. The
   * only thing that changes the system prompt between turns, so it explains an
   * input-token count that doesn't look like the others.
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

/** The app's UIMessage type. Use it instead of a bare `UIMessage`. */
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
 * True for a class the site renders nothing for (`aborted`: the reader pressed
 * stop). A client-side abort never reaches the error path (the SDK swallows
 * it), but the route can also send `aborted` over a live stream, so the check
 * is on the class.
 */
export function isSilentClass(cls: TurnErrorClass): boolean {
  return TURN_FAILURES[cls].silent;
}

/**
 * Whether "try again" belongs under the sentence for this class.
 *
 * Every class is worth another attempt except `invalid_request`: a visitor
 * reaches it only with a message too long for the schema, and retry resends
 * the same message. Its copy says to shorten it instead.
 */
export function isRetryableClass(cls: TurnErrorClass): boolean {
  return TURN_FAILURES[cls].retryable;
}

/** Whether "ask a different model" belongs beside "try again". */
export function offersModelSwitch(cls: TurnErrorClass): boolean {
  return TURN_FAILURES[cls].switchModel;
}

/** Narrows an arbitrary string (an error message, a JSON error body) to a class. */
export function toTurnErrorClass(value: unknown): TurnErrorClass {
  return typeof value === "string" && Object.hasOwn(TURN_FAILURES, value)
    ? (value as TurnErrorClass)
    : "unknown";
}

// --- What the reader is told -----------------------------------------------
//
// One sentence per class, saying what happened and what to do about it. The
// sentences live in the table above; these two functions are the lookup.

/** The sentence for a class, falling back to the generic one. */
export function turnErrorCopy(cls: TurnErrorClass): string {
  return TURN_FAILURES[cls].copy ?? TURN_FAILURES.unknown.copy;
}

/**
 * The short label above the sentence, rendered as `turn failed · <label>`.
 * Falls back to the class id.
 */
export function turnErrorLabel(cls: TurnErrorClass): string {
  return TURN_FAILURES[cls].label ?? cls;
}
