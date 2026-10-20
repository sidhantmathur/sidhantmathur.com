// The browser's fetch for the chat route (`guardedFetch`). It turns every
// failure into one of the telemetry error classes, reads the hourly budget off
// the response headers, puts two clocks on the request, and fails a turn that
// finished having said nothing.
//
// useChat's onError receives only an Error, not the HTTP status, so the class
// is read here (from the JSON body the route sends on an early exit, or from
// the status) and encoded as the message. Mid-stream failures already arrive as
// a class string, because the route's stream `onError` returns one.
//
// Without a client-side timeout, a stream that stops arriving (iOS Safari
// suspending a tab mid-answer, for one) leaves `status` at "streaming" forever
// and every later send returns early. Two clocks:
//
//   connect   to the response headers (CONNECT_TIMEOUT_MS). A request
//             unanswered that long is gone, not slow.
//   inactive  between chunks (STREAM_IDLE_TIMEOUT_MS). Catches a connection
//             that is established and then stops.
//
// Not `AbortSignal.timeout` over the whole request: a healthy job-posting turn
// spends three model steps and can legitimately run past a minute.

import { toTurnErrorClass, type TurnErrorClass } from "./chat-telemetry.ts";

/** Headers must arrive within this. */
export const CONNECT_TIMEOUT_MS = 15_000;
/** And once they have, a chunk must arrive at least this often. */
export const STREAM_IDLE_TIMEOUT_MS = 20_000;

export type Budget = { remaining: number; limit: number };

/**
 * A failure this module has already classified. The message is the class
 * string, for anything reading `error.message` (the SDK's plumbing included);
 * `cls` is the typed way to read the same thing.
 */
export class TurnFailure extends Error {
  readonly cls: TurnErrorClass;
  constructor(cls: TurnErrorClass) {
    super(cls);
    this.cls = cls;
    this.name = "TurnFailure";
  }
}

export type TransportDeps = {
  /** Defaults to `globalThis.fetch`. A test passes a scripted one. */
  fetch?: typeof fetch;
  connectTimeoutMs?: number;
  idleTimeoutMs?: number;
  onBudget?: (b: Budget) => void;
};

/** True for the shape a browser reports when the network itself failed. */
function isNetworkError(err: unknown): boolean {
  // Safari says "Load failed", Chrome and Firefox say "Failed to fetch"; all
  // three raise a TypeError, which no other path here throws.
  return err instanceof TypeError;
}

/**
 * True for the shape the SDK reads as "this turn was aborted".
 *
 * Matches `isAbortError` in @ai-sdk/provider-utils: browsers raise a
 * DOMException here, which is not an Error in every engine, so the name alone
 * is not enough to test on.
 */
function isAbortError(err: unknown): boolean {
  const named = err as { name?: unknown } | null;
  if (!named || typeof named.name !== "string") return false;
  return (
    (err instanceof Error ||
      (typeof DOMException !== "undefined" && err instanceof DOMException)) &&
    named.name === "AbortError"
  );
}

/**
 * Classifies whatever `reader.read()` threw. A network drop arrives as a
 * TypeError and is `network`, not `unknown`. The stop button races the reader:
 * depending on the browser it surfaces as an AbortError or as a TypeError from
 * the socket dying underneath, so the caller's signal is the authority on
 * aborts. Only `stop()` and navigation abort that signal; the idle watchdog
 * aborts our own controller instead.
 */
function classifyStreamError(err: unknown, outer: AbortSignal | null | undefined): unknown {
  // A genuine abort passes through untouched, so the SDK takes its abort path
  // (status back to "ready", no error rendered) rather than its failure path.
  if (isAbortError(err)) return err;
  if (outer?.aborted) return new DOMException("The turn was aborted.", "AbortError");
  if (isNetworkError(err)) return new TurnFailure("network");
  return err;
}

// --- A turn that said nothing ----------------------------------------------
//
// A reasoning model can spend its whole output ceiling thinking and finish on
// `finishReason: "length"` without writing a word. Nothing errors: the stream
// closes cleanly, the SDK says "ready", and the shell shows nothing.
//
// The transport already reads every byte for its idle clock, so when a turn
// put nothing on the page it appends one `empty_answer` error chunk in the
// SDK's wire format, and the turn fails like a real mid-stream failure.
// Appended rather than thrown, because erroring a stream discards whatever the
// reader hasn't consumed yet, including the turn's closing telemetry record.

/**
 * Tools whose output has no surface of its own. `extractRequirements` is the
 * first half of a job-posting turn: its output feeds the assessment and is
 * rendered inside it, so a turn that extracted and then stopped has still shown
 * nothing. The shell reads the same set to decide which tool parts get a chip.
 */
export const INTERNAL_TOOLS: ReadonlySet<string> = new Set(["extractRequirements"]);

/** The chunk appended to a turn that finished empty. SSE, as the route writes it. */
const EMPTY_ANSWER_CHUNK = `data: ${JSON.stringify({
  type: "error",
  errorText: "empty_answer",
} satisfies { type: "error"; errorText: TurnErrorClass })}\n\n`;

type StreamChunk = {
  type?: unknown;
  delta?: unknown;
  toolCallId?: unknown;
  toolName?: unknown;
};

/**
 * Reads a UI message stream as it passes: did this turn say nothing?
 * Deliberately narrow, so it can't invent a failure: "empty" only for a turn
 * that reached its `finish` chunk with no visible text, no tool output with a
 * surface, and no error of its own. It stops parsing once anything visible
 * arrives.
 */
function answerWatcher() {
  const dec = new TextDecoder();
  let pending = "";
  let said = false;
  let finished = false;
  let failed = false;
  const toolNames = new Map<string, string>();

  function readLine(line: string) {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(payload) as StreamChunk;
    } catch {
      return;
    }
    switch (chunk.type) {
      case "text-delta":
        if (typeof chunk.delta === "string" && chunk.delta.trim()) said = true;
        break;
      case "tool-input-start":
      case "tool-input-available":
        if (typeof chunk.toolCallId === "string" && typeof chunk.toolName === "string") {
          toolNames.set(chunk.toolCallId, chunk.toolName);
        }
        break;
      case "tool-output-available": {
        // An output whose call was never named counts as visible: the watcher
        // would rather miss an empty turn than fail a real one.
        const name =
          typeof chunk.toolCallId === "string" ? toolNames.get(chunk.toolCallId) : undefined;
        if (name === undefined || !INTERNAL_TOOLS.has(name)) said = true;
        break;
      }
      case "error":
        failed = true;
        break;
      case "finish":
        finished = true;
        break;
    }
  }

  function readLines(text: string) {
    pending += text;
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      readLine(line);
      if (said) return;
    }
  }

  return {
    feed(bytes: Uint8Array) {
      if (!said) readLines(dec.decode(bytes, { stream: true }));
    },
    /** Called once, after the last chunk. */
    saidNothing(): boolean {
      if (said) return false;
      readLines(dec.decode() + "\n");
      return finished && !said && !failed;
    },
  };
}

/**
 * Wraps a response body so a stream that goes quiet fails with a class instead
 * of hanging: `onError` fires, `status` becomes "error", and the next send
 * works. Also watches for a turn that said nothing (`answerWatcher`).
 */
function watchStream(
  body: ReadableStream<Uint8Array>,
  abort: () => void,
  /** The caller's signal. Aborted exactly when the reader pressed stop. */
  outer: AbortSignal | null | undefined,
  idleTimeoutMs: number,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const watcher = answerWatcher();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firedTimeout = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const clear = () => {
        if (timer != null) clearTimeout(timer);
        timer = null;
      };
      const bump = () => {
        clear();
        timer = setTimeout(() => {
          firedTimeout = true;
          // Release the socket first, so the abort can't race a reader that is
          // already unwinding.
          abort();
          controller.error(new TurnFailure("upstream_timeout"));
          void reader.cancel().catch(() => {});
        }, idleTimeoutMs);
      };

      bump();
      void (async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
            watcher.feed(value);
            bump();
          }
          clear();
          // Not when the reader pressed stop: a stream that closed cleanly
          // under an abort is still an abort, and renders nothing.
          if (!outer?.aborted && watcher.saidNothing()) {
            controller.enqueue(new TextEncoder().encode(EMPTY_ANSWER_CHUNK));
          }
          controller.close();
        } catch (err) {
          clear();
          // After a timeout the stream is already errored, and a second
          // `controller.error` would throw.
          if (!firedTimeout) controller.error(classifyStreamError(err, outer));
        }
      })();
    },
    cancel(reason) {
      if (timer != null) clearTimeout(timer);
      return reader.cancel(reason);
    },
  });
}

export function guardedFetch(deps: TransportDeps = {}): typeof fetch {
  const doFetch = deps.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const connectTimeoutMs = deps.connectTimeoutMs ?? CONNECT_TIMEOUT_MS;
  const idleTimeoutMs = deps.idleTimeoutMs ?? STREAM_IDLE_TIMEOUT_MS;
  const onBudget = deps.onBudget;

  return async (input, init) => {
    // Our own controller, so the timers can abort; the SDK's signal is
    // forwarded into it, so `stop()` still works.
    const ctrl = new AbortController();
    const outer = init?.signal;
    if (outer) {
      if (outer.aborted) ctrl.abort(outer.reason);
      else outer.addEventListener("abort", () => ctrl.abort(outer.reason), { once: true });
    }

    let connectTimedOut = false;
    const connectTimer = setTimeout(() => {
      connectTimedOut = true;
      ctrl.abort();
    }, connectTimeoutMs);

    let res: Response;
    try {
      res = await doFetch(input, { ...init, signal: ctrl.signal });
    } catch (err) {
      // Rethrown as a class: "your connection" versus "my server" is only
      // knowable here.
      if (connectTimedOut) throw new TurnFailure("upstream_timeout");
      if (isNetworkError(err)) throw new TurnFailure("network");
      throw err;
    } finally {
      clearTimeout(connectTimer);
    }

    if (!res.ok) {
      let code: TurnErrorClass = res.status === 429 ? "rate_limited" : "upstream_unavailable";
      try {
        const body = (await res.clone().json()) as { error?: string };
        if (body?.error) code = toTurnErrorClass(body.error);
      } catch {
        /* non-JSON body — the status-derived class above stands */
      }
      throw new TurnFailure(code);
    }
    // Checked for presence first: Number(null) is 0, which is finite, so a
    // response without the headers would otherwise report an empty budget.
    const remainingHeader = res.headers.get("x-budget-remaining");
    const limitHeader = res.headers.get("x-budget-limit");
    const remaining = Number(remainingHeader);
    const limit = Number(limitHeader);
    if (remainingHeader && limitHeader && Number.isFinite(remaining) && Number.isFinite(limit)) {
      onBudget?.({ remaining, limit });
    }
    if (!res.body) return res;
    // Rebuilt from the original response so status, statusText and every header
    // survive — the budget read above is not the only thing that reads them.
    return new Response(
      watchStream(res.body, () => ctrl.abort(), outer, idleTimeoutMs),
      res,
    );
  };
}
