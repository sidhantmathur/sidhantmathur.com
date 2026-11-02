// The extra assessments behind a consistent fit check (lib/consistency.ts).
//
// They start when the turn's own judging step starts, from the same prompt
// that step is sent: the same system message, the same conversation, the same
// extraction call and its result, the same tools, the same forced `roleFit`
// choice, the same output ceiling and the same reasoning level. So each one is
// the turn's own assessment again, run independently and at the same time,
// and the card waits for the slowest of them rather than for all of them in a
// row.
//
// They are internal. They never reach the reader's stream except as a count,
// they spend no visitor turn (the route's budget is charged once per request),
// and what they cost is added to the turn's usage, so the cost meter counts
// them. Each one shares the request's abort signal: stop, a dropped
// connection or the end of the turn stops them too.
//
// Server-only, because it calls the model. The merge it feeds is in
// lib/consistency.ts and loads without the SDK.

import { generateText, type LanguageModelUsage, type ModelMessage, type ToolSet } from "ai";
import { providerOptionsFor, reasoningFor, type ModelId } from "./models.ts";
import type { RawRoleFit } from "./role-fit.ts";
import type { TurnUsage } from "./chat-telemetry.ts";

const ROLE_FIT_TOOL = "roleFit";

/** How one extra assessment ended. */
export type SampleOutcome = {
  /** Its `roleFit` input, or null when it produced none. */
  input: RawRoleFit | null;
  /** What the provider reported, or null when it never did. */
  usage: TurnUsage | null;
  /** Launch to settle, or to the moment it was given up on. */
  ms: number;
  /** Why there is no input: the call failed, was stopped, or called nothing. */
  failure: "error" | "aborted" | "no-call" | null;
};

export type FitSamples = {
  /** How many extra assessments are running. */
  readonly count: number;
  /**
   * Waits for them, at most `graceMs` from now, then gives up on the rest:
   * they are stopped and their outcome is `aborted`. `onProgress` gets the
   * number settled so far, at once if any are still out, on each settle while
   * waiting, and every `heartbeatMs` so the stream isn't silent.
   */
  collect(options: {
    graceMs: number;
    heartbeatMs: number;
    onProgress: (settled: number) => void;
  }): Promise<SampleOutcome[]>;
  /** Stops whatever is still running and returns every outcome. Idempotent. */
  finish(): SampleOutcome[];
};

/**
 * The same tools with nothing to run: a sample only needs the call, and the
 * call must not execute `roleFit`, whose own execute is what waits for it.
 */
export function definitionsOnly(tools: ToolSet): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, t]) => {
      const definition: Record<string, unknown> = { ...t };
      delete definition.execute;
      return [name, definition];
    }),
  ) as ToolSet;
}

function toTurnUsage(usage: LanguageModelUsage): TurnUsage {
  return {
    inputTokens: usage.inputTokens ?? null,
    cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? null,
    cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
  };
}

/**
 * Starts `count` extra assessments of the step whose prompt is `messages`, or
 * returns null when there are none to start.
 */
export function startFitSamples(options: {
  count: number;
  model: ModelId;
  /** The judging step's prompt, exactly as prepareStep hands it over. */
  messages: ModelMessage[];
  tools: ToolSet;
  maxOutputTokens: number;
  abortSignal?: AbortSignal;
}): FitSamples | null {
  const { count, model, messages, tools, maxOutputTokens, abortSignal } = options;
  if (!Number.isInteger(count) || count < 1) return null;

  const stopper = new AbortController();
  const signal = abortSignal ? AbortSignal.any([abortSignal, stopper.signal]) : stopper.signal;
  const startedAt = Date.now();
  const definitions = definitionsOnly(tools);

  const outcomes: (SampleOutcome | undefined)[] = Array.from({ length: count }, () => undefined);
  let frozen: SampleOutcome[] | null = null;
  const listeners = new Set<() => void>();
  let settled = 0;

  const runOne = async (): Promise<SampleOutcome> => {
    try {
      const result = await generateText({
        model,
        messages,
        allowSystemInMessages: true,
        tools: definitions,
        toolChoice: { type: "tool", toolName: ROLE_FIT_TOOL },
        maxOutputTokens,
        // The catalogue's level for a posting turn: the judging step's own.
        reasoning: reasoningFor(model, { jobPosting: true }),
        // The same Gateway routing as the turn's own call, so a pinned model's
        // extra assessments bill at the price the cost meter assumes.
        providerOptions: providerOptionsFor(model),
        abortSignal: signal,
      });
      const call = result.toolCalls.find((c) => c.toolName === ROLE_FIT_TOOL);
      // An input that fails the tool's schema is still the assessment it
      // made; the reconciler normalizes it, as it would the turn's own.
      const input =
        call && call.input && typeof call.input === "object" ? (call.input as RawRoleFit) : null;
      return {
        input,
        usage: toTurnUsage(result.totalUsage),
        ms: Date.now() - startedAt,
        failure: input ? null : "no-call",
      };
    } catch (err) {
      if (!signal.aborted) console.error("[chat] fit sample failed", err);
      return {
        input: null,
        usage: null,
        ms: Date.now() - startedAt,
        failure: signal.aborted ? "aborted" : "error",
      };
    }
  };

  const all = Promise.all(
    outcomes.map((_, i) =>
      runOne().then((outcome) => {
        outcomes[i] = outcome;
        settled += 1;
        for (const listener of listeners) listener();
        return outcome;
      }),
    ),
  );

  const finish = (): SampleOutcome[] => {
    if (frozen) return frozen;
    // Anything still out is given up on. Its usage never comes back, which is
    // what lib/consistency.ts's ceiling is for.
    stopper.abort();
    const at = Date.now() - startedAt;
    frozen = outcomes.map(
      (o) => o ?? { input: null, usage: null, ms: at, failure: "aborted" as const },
    );
    return frozen;
  };

  return {
    count,
    finish,
    collect({ graceMs, heartbeatMs, onProgress }) {
      if (frozen) return Promise.resolve(frozen);
      return new Promise<SampleOutcome[]>((resolve) => {
        let done = false;
        const report = () => {
          if (!done) onProgress(settled);
        };
        const close = () => {
          if (done) return;
          done = true;
          clearInterval(heartbeat);
          clearTimeout(timer);
          listeners.delete(report);
          resolve(finish());
        };
        if (settled < count) report();
        listeners.add(report);
        const heartbeat = setInterval(report, heartbeatMs);
        const timer = setTimeout(close, graceMs);
        void all.then(close);
      });
    },
  };
}
