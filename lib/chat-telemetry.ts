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

export type TurnErrorClass =
  /** Body failed schema validation. Bad client, not a bad model. */
  | "invalid_request"
  /** Per-tier hourly budget spent, or the 10-turn conversation cap. */
  | "rate_limited"
  /** No AI_GATEWAY_API_KEY on the server — a deploy problem, not a runtime one. */
  | "upstream_unconfigured"
  /** The Gateway rejected our credentials. */
  | "upstream_auth"
  /** The model took too long or the connection dropped mid-stream. */
  | "upstream_timeout"
  /** The Gateway or the model itself failed. */
  | "upstream_unavailable"
  /** The reader navigated away or hit stop. Not a failure to report as one. */
  | "aborted"
  /** Classification fell through. Always worth reading the server log for. */
  | "unknown";

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
  return cls === "rate_limited";
}

/** Narrows an arbitrary string (an error message, a JSON error body) to a class. */
export function toTurnErrorClass(value: unknown): TurnErrorClass {
  const known: TurnErrorClass[] = [
    "invalid_request",
    "rate_limited",
    "upstream_unconfigured",
    "upstream_auth",
    "upstream_timeout",
    "upstream_unavailable",
    "aborted",
    "unknown",
  ];
  return known.includes(value as TurnErrorClass) ? (value as TurnErrorClass) : "unknown";
}
