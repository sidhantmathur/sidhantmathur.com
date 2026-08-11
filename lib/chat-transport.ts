// --- The guarded fetch ------------------------------------------------------
//
// Turns any failure into one of the telemetry error classes. useChat's onError
// receives only an Error, not the HTTP status, so the class is read here — from
// the JSON body the route sends on an early exit, or from the status — and
// encoded as the message. Mid-stream failures already arrive as a class string,
// because the route's stream `onError` returns one.
//
// Also lifts the per-tier budget out of the response headers, which is where it
// lands before a single token has streamed.
//
// AND IT PUTS A CLOCK ON THE WHOLE THING, which is the reason this file was
// reopened. There was no timeout anywhere on the client path: a stream that
// simply stopped arriving — iOS Safari suspending the tab mid-answer is the
// case this was reported from, at a restaurant, on a phone — left `status` at
// "streaming" forever. `isBusy` stays true, `submit()` returns early on every
// later send, and the site is silently dead until the visitor reloads it. They
// don't reload. They leave.
//
// Two clocks, because one would have to be wrong:
//
//   connect   15s to the response HEADERS. A request that hasn't been answered
//             in fifteen seconds isn't slow, it's gone.
//   inactive  20s between CHUNKS. This is the one that catches the reported
//             failure, where the connection is established and then stops.
//
// Deliberately NOT `AbortSignal.timeout` over the whole request: a healthy
// job-posting turn spends three model steps and can legitimately run past a
// minute, and a total-duration abort would kill it mid-answer.
//
// The seam is `fetch` itself, and it is injectable: the browser passes the real
// one, a test passes a scripted one. Same for the two clocks, so a test can
// assert the thresholds without sitting through fifteen seconds of them.

import { toTurnErrorClass, type TurnErrorClass } from "./chat-telemetry.ts";

/** Headers must arrive within this. */
export const CONNECT_TIMEOUT_MS = 15_000;
/** And once they have, a chunk must arrive at least this often. */
export const STREAM_IDLE_TIMEOUT_MS = 20_000;

export type Budget = { tier: string; remaining: number; limit: number };

/**
 * A failure this module has already classified.
 *
 * The message IS the class string, so anything still reading `error.message` —
 * the SDK's own plumbing included — sees exactly what it saw before. `cls` is
 * the typed way to read the same thing without a string round-trip.
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
 * What a failure DURING the stream actually was, in the vocabulary the rest of
 * the site speaks. Called with whatever `reader.read()` threw.
 *
 * Passing the raw error through — which is what this used to do — got two
 * things wrong, both of them visible:
 *
 *   a wifi drop mid-answer  arrived as a TypeError, fell through to "unknown",
 *                           and the unknown copy says "something went wrong on
 *                           my end" — the site apologising for the visitor's
 *                           train going into a tunnel. It is a `network`
 *                           failure and the network copy is the true one.
 *   the stop button         rendered an error block roughly one run in five.
 *                           An abort races the reader: depending on the browser
 *                           and on where in the pipeline the tear-down lands,
 *                           what surfaces here is sometimes a clean AbortError
 *                           and sometimes a TypeError from the socket dying
 *                           underneath it. The design rule is that an aborted
 *                           turn renders NOTHING, so the shape of the error is
 *                           the wrong thing to read.
 *
 * So the outer signal is the authority on the second one: if the caller's
 * signal is aborted, the reader pressed stop, whatever the error looks like.
 * That signal is aborted by `stop()` and by navigation only — the idle
 * watchdog below aborts our own controller, never this one.
 */
function classifyStreamError(err: unknown, outer: AbortSignal | null | undefined): unknown {
  // A genuine abort passes through untouched, so the SDK takes its abort path
  // (status back to "ready", no error rendered) rather than its failure path.
  if (isAbortError(err)) return err;
  if (outer?.aborted) return new DOMException("The turn was aborted.", "AbortError");
  if (isNetworkError(err)) return new TurnFailure("network");
  return err;
}

/**
 * Wraps a response body so a stream that goes quiet fails instead of hanging.
 *
 * The wrapped stream is errored with a real class, which is the whole point:
 * the SDK surfaces it, `onError` fires, `status` becomes "error", `isBusy`
 * goes false, and the NEXT SEND WORKS. A silent stall does none of that.
 */
function watchStream(
  body: ReadableStream<Uint8Array>,
  abort: () => void,
  /** The caller's signal. Aborted exactly when the reader pressed stop. */
  outer: AbortSignal | null | undefined,
  idleTimeoutMs: number,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
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
          // Release the socket first, then fail the stream. The other order
          // works too, but this way the abort can't race a reader that is
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
            bump();
          }
          clear();
          controller.close();
        } catch (err) {
          clear();
          // Already errored above — a second `controller.error` would throw.
          // Everything else is classified rather than passed through raw: see
          // classifyStreamError for the two failures that made this necessary.
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
    // Our own controller rather than the caller's, so the timers below can
    // abort a request the SDK has no reason to abort. The SDK's signal is
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
      // Rethrown as a class rather than as whatever the platform said. The
      // distinction that matters to the reader is "your connection" versus
      // "my server", and it is only knowable here.
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
    const tier = res.headers.get("x-tier");
    const remaining = Number(res.headers.get("x-tier-remaining"));
    const limit = Number(res.headers.get("x-tier-limit"));
    if (tier && Number.isFinite(remaining) && Number.isFinite(limit)) {
      onBudget?.({ tier, remaining, limit });
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
