"use client";

import { useMemo, useState } from "react";
import {
  MODEL_PRICES,
  PRICES_CHECKED,
  costOfTurn,
  formatTokens,
  formatUsd,
  sumCosts,
} from "@/lib/pricing";
import type { TurnErrorClass } from "@/lib/chat-telemetry";
import type { Budget, TurnRecord } from "./use-conversation";
import type { TokenRate } from "./use-token-rate";

// The instrument deck (roadmap Sprint 2: #1 cost meter, #3 glass-box trace,
// #5 seismograph, #6 failure theatre, #16 teletype toggle).
//
// WHERE THIS LIVES, AND WHY IT ISN'T IN THE CONVERSATION. The decisions doc's
// instrumentation policy is the constraint every choice here answers to:
// density is a legitimate aesthetic on this site, but it lives AROUND the
// conversation and never in front of it, and a visitor who ignores every
// readout still has a working chatbot. So:
//
//   * The always-visible half is four numbers in the status strip that was
//     already there — turns, latency, rate, dollars. Nothing new appears in the
//     message column, and nothing pushes the answer down the page.
//   * The dense half opens in the existing context panel, on a deliberate
//     click, next to the conversation rather than over it. It is the same
//     surface the resume and the role-fit breakdown already use.
//   * Nothing in here adds a step, a mode, or a decision to asking a question.
//     Every control is idempotent and every readout is passive. The one thing
//     that makes a network request (failure theatre) cannot produce an answer,
//     cannot spend the budget, and reports into its own box.
//
// The numbers are F1's, unchanged. Sprint 1 measured all of this and rendered
// none of it; this file is the other half of that sentence.

// ---------------------------------------------------------------------------
// Seismograph (#5)
// ---------------------------------------------------------------------------

/**
 * A needle, not a chart. Draws the live sampled rate while a turn streams and
 * holds the trace afterwards, because a flatline that disappears teaches
 * nothing about the hiccup that caused it.
 */
export function Seismograph({
  rate,
  settled,
  width = 64,
  height = 16,
}: {
  rate: TokenRate;
  /** The server's exact figure for the last completed turn, if there is one. */
  settled: number | null;
  width?: number;
  height?: number;
}) {
  const { samples, live, peak } = rate;
  // A floor on the scale stops a slow turn from being drawn as a mountain range.
  const scale = Math.max(peak, 20);

  const points = samples.length
    ? samples
        .map((value, i) => {
          const x = (i / Math.max(1, samples.length - 1)) * width;
          const y = height - Math.min(1, value / scale) * height;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")
    : `0,${height} ${width},${height}`;

  // The TRACE draws raw samples — the gaps between chunks are the interesting
  // part and smoothing them away would be a lie about what arrived when. The
  // READOUT is averaged over the last few samples, because a number that snaps
  // to zero every time a chunk boundary lands between two samples is unreadable
  // and says nothing true either.
  const recent = samples.slice(-4);
  const smoothed = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const reading =
    live != null ? `≈${Math.round(smoothed)}` : settled != null ? `${Math.round(settled)}` : "—";

  return (
    <span className="flex items-center gap-1.5" title="Output tokens per second">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
        className="overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className={live != null ? "text-accent" : "text-line-strong"}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="tabular-nums text-text-soft">{reading}</span>
      <span>tok/s</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// The deck
// ---------------------------------------------------------------------------

export type ErrorCopy = { error: string; rateLimited: string };

export function InstrumentDeck({
  turnLog,
  budget,
  model,
  rate,
  teletype,
  onToggleTeletype,
  errorCopy,
}: {
  turnLog: TurnRecord[];
  budget: Budget | null;
  model: string;
  rate: TokenRate;
  teletype: boolean;
  onToggleTeletype: () => void;
  errorCopy: ErrorCopy;
}) {
  const settled = lastSettledRate(turnLog);
  return (
    <div className="space-y-6">
      <Section title="Cost" hint={`est. at list price · checked ${PRICES_CHECKED}`}>
        <CostMeter turnLog={turnLog} budget={budget} model={model} />
      </Section>

      <Section title="Rate">
        <div className="flex items-center gap-3 text-[11px] text-text-faint">
          <Seismograph rate={rate} settled={settled} width={120} height={22} />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
          The live needle is sampled from the text as it arrives and marked{" "}
          <span className="text-text-soft">≈</span>. The number without one is the
          server&apos;s own measurement of the last finished turn.
        </p>
      </Section>

      <Section title="Trace" hint={`${turnLog.length} turn${turnLog.length === 1 ? "" : "s"}`}>
        <TraceInspector turnLog={turnLog} />
      </Section>

      <Section title="Failure theatre">
        <FailureTheatre errorCopy={errorCopy} />
      </Section>

      <Section title="Sound">
        <button
          type="button"
          onClick={onToggleTeletype}
          aria-pressed={teletype}
          className="border border-line-strong px-2.5 py-2 text-[11px] text-text-soft transition-colors hover:border-accent hover:text-accent"
        >
          teletype {teletype ? "on" : "off"}
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-text-faint">
          A tick per chunk of text, pitched to how fast it&apos;s arriving. Synthesized in
          the browser, off until you switch it on, and remembered after that.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-line pb-1">
        <h3 className="text-[11px] text-text">{title}</h3>
        {hint && <span className="shrink-0 text-[10px] text-text-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Label/value row. The deck is a table of these and little else. */
function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <span className="text-text-faint">{label}</span>
      <span className={`tabular-nums ${emphasis ? "text-accent" : "text-text-soft"}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost meter (#1)
// ---------------------------------------------------------------------------

/**
 * The single home for everything budget-related, which is what the decisions
 * doc asked for: the turn counter, the per-tier allowance, the dollars, and the
 * privacy framing all land here rather than becoming four separate surfaces.
 */
function CostMeter({
  turnLog,
  budget,
  model,
}: {
  turnLog: TurnRecord[];
  budget: Budget | null;
  model: string;
}) {
  const completed = turnLog.filter((t) => t.usage != null && t.error == null);
  const session = useMemo(
    () => sumCosts(completed.map((t) => costOfTurn(t.model, t.usage))),
    [completed],
  );
  const latest = completed[completed.length - 1] ?? null;
  const latestCost = latest ? costOfTurn(latest.model, latest.usage) : null;
  const priced = MODEL_PRICES[model] != null;

  const tokens = completed.reduce(
    (acc, t) => ({
      input: acc.input + (t.usage?.inputTokens ?? 0),
      cached: acc.cached + (t.usage?.cachedInputTokens ?? 0),
      output: acc.output + (t.usage?.outputTokens ?? 0),
    }),
    { input: 0, cached: 0, output: 0 },
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {budget && (
          <Row label={`${budget.tier} budget`} value={`${budget.remaining}/${budget.limit} left`} />
        )}
        <Row label="answers this session" value={String(completed.length)} />
        <Row label="input tokens" value={formatTokens(tokens.input)} />
        <Row label="of those, cached" value={formatTokens(tokens.cached)} />
        <Row label="output tokens" value={formatTokens(tokens.output)} />
        <Row label="session cost" value={formatUsd(session.total)} emphasis />
        <Row label="saved by the cache" value={formatUsd(session.saved)} />
      </div>

      {latest && latestCost && (
        <div className="space-y-1 border-t border-line pt-2">
          <div className="text-[10px] text-text-faint">last turn · {latest.model}</div>
          <Row label="fresh input" value={formatUsd(latestCost.freshInput)} />
          <Row label="cached input" value={formatUsd(latestCost.cacheRead)} />
          {latestCost.cacheWrite > 0 && (
            <Row label="cache write" value={formatUsd(latestCost.cacheWrite)} />
          )}
          <Row label="output" value={formatUsd(latestCost.output)} />
          <Row label="turn total" value={formatUsd(latestCost.total)} emphasis />
        </div>
      )}

      {!priced && (
        <p className="text-[11px] leading-relaxed text-text-faint">
          No list price on file for {model}, so its turns are left out of the total rather
          than estimated.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-text-faint">
        Estimated at published list price. The knowledge base is byte-identical on every
        request, so once it is cached that part of the input bills at a fraction of the
        fresh rate — the saving is the line above.
      </p>
      <p className="text-[11px] leading-relaxed text-text-faint">
        Nothing you type is stored on the server. The conversation lives in this browser
        until you reset it, and the only thing kept server-side is a per-IP counter for the
        hourly limit.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Glass box (#3)
// ---------------------------------------------------------------------------

/**
 * Per-turn trace. The status strip asserts that this site is cost- and
 * latency-engineered; this is where that claim is checkable — including the two
 * latencies, which are deliberately not reconciled into one number.
 */
function TraceInspector({ turnLog }: { turnLog: TurnRecord[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!turnLog.length) {
    return (
      <p className="text-[11px] leading-relaxed text-text-faint">
        Nothing yet. Ask a question and every number behind the answer lands here.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {turnLog
        .map((turn, i) => ({ turn, i }))
        .reverse()
        .map(({ turn, i }) => {
          const open = openIndex === i;
          const cost = costOfTurn(turn.model, turn.usage);
          return (
            <div key={i} className="border border-line">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-raised"
              >
                <span className="tabular-nums text-text-faint">#{i + 1}</span>
                <span className={turn.error ? "text-accent" : "text-text-soft"}>
                  {turn.error ? turn.error.class : shortModel(turn.model)}
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-text-faint">
                  {turn.timing?.ttftMs != null ? `${turn.timing.ttftMs}ms` : "—"}
                </span>
                <span className="shrink-0 tabular-nums text-text-faint">
                  {cost ? formatUsd(cost.total) : "—"}
                </span>
                <span className="shrink-0 text-text-faint">{open ? "−" : "+"}</span>
              </button>
              {open && (
                <div className="space-y-1 border-t border-line px-2 py-2">
                  <Row label="model" value={turn.model} />
                  <Row label="tier" value={turn.tier} />
                  <Row label="job posting" value={turn.jobPosting ? "yes" : "no"} />
                  {/* The only per-turn change to the system prompt on this
                      site, and therefore the only honest explanation for an
                      input count that doesn't match the turn above it. */}
                  <Row
                    label="corpus"
                    value={turn.siteQuestion ? "knowledge + repo" : "knowledge"}
                  />
                  <Row
                    label="ttft (server)"
                    value={turn.timing?.ttftMs != null ? `${turn.timing.ttftMs}ms` : "—"}
                  />
                  <Row
                    label="ttft (browser)"
                    value={turn.clientTtftMs != null ? `${turn.clientTtftMs}ms` : "—"}
                  />
                  <Row
                    label="duration"
                    value={turn.timing?.durationMs != null ? `${turn.timing.durationMs}ms` : "—"}
                  />
                  <Row
                    label="tokens/sec"
                    value={
                      turn.timing?.tokensPerSecond != null
                        ? String(turn.timing.tokensPerSecond)
                        : "—"
                    }
                  />
                  <Row label="input" value={formatTokens(turn.usage?.inputTokens)} />
                  <Row label="cache read" value={formatTokens(turn.usage?.cachedInputTokens)} />
                  <Row label="cache write" value={formatTokens(turn.usage?.cacheWriteTokens)} />
                  <Row label="output" value={formatTokens(turn.usage?.outputTokens)} />
                  <Row
                    label="prompt cache"
                    value={(turn.usage?.cachedInputTokens ?? 0) > 0 ? "hit" : "miss"}
                  />
                  <Row label="steps" value={turn.steps != null ? String(turn.steps) : "—"} />
                  <Row
                    label="tools"
                    value={turn.toolsCalled?.length ? turn.toolsCalled.join(", ") : "none"}
                  />
                  <Row label="finish reason" value={turn.finishReason ?? "—"} />
                  {turn.error && <Row label="error" value={turn.error.class} emphasis />}
                  <details className="pt-1">
                    <summary className="cursor-pointer text-[10px] text-text-faint hover:text-accent">
                      raw record
                    </summary>
                    <pre className="mt-1 overflow-x-auto bg-raised p-2 text-[10px] leading-relaxed text-text-soft">
                      {JSON.stringify(turn, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          );
        })}
      <p className="pt-1 text-[10px] leading-relaxed text-text-faint">
        Two latencies on purpose: the server measures the model, the browser measures the
        wait. The gap between them is the network.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Failure theatre (#6)
// ---------------------------------------------------------------------------

type FailureSpec = {
  cls: TurnErrorClass;
  /** What actually causes it in production. */
  cause: string;
  /** How it reaches the client. */
  wire: string;
};

// One entry per exit in app/api/chat/route.ts. The split between the first
// three and the rest is the interesting part: an early failure is a status
// code, a late one is an HTTP 200 whose stream ends in an error chunk, and a
// client that only checked `res.ok` would call the second kind a success.
const FAILURES: FailureSpec[] = [
  {
    cls: "invalid_request",
    cause: "The request body failed schema validation — a bad client, not a bad model.",
    wire: "400, JSON body",
  },
  {
    cls: "rate_limited",
    cause: "The hourly per-tier budget is spent, or the conversation passed ten turns.",
    wire: "429, JSON body",
  },
  {
    cls: "upstream_unconfigured",
    cause: "No gateway key on the server. A deploy problem, checked before the model is called.",
    wire: "502, JSON body",
  },
  {
    cls: "upstream_auth",
    cause: "The gateway rejected our credentials. It surfaces mid-stream, which is why the key is checked up front.",
    wire: "200, error chunk",
  },
  {
    cls: "upstream_timeout",
    cause: "The model took too long, or the connection dropped part-way through an answer.",
    wire: "200, error chunk",
  },
  {
    cls: "upstream_unavailable",
    cause: "The gateway or the model itself failed.",
    wire: "200, error chunk",
  },
  {
    cls: "aborted",
    cause: "The reader navigated away or hit stop. Not a failure to report as one.",
    wire: "200, error chunk",
  },
  {
    cls: "unknown",
    cause: "Classification fell through. Always worth reading the server log for.",
    wire: "200, error chunk",
  },
];

type FailureResult = {
  cls: TurnErrorClass;
  status: number;
  /** What the visitor would have been shown. */
  shown: string;
  /** The first hundred-odd characters of what actually came back. */
  raw: string;
};

function FailureTheatre({ errorCopy }: { errorCopy: ErrorCopy }) {
  const [running, setRunning] = useState<TurnErrorClass | null>(null);
  const [result, setResult] = useState<FailureResult | null>(null);

  async function run(cls: TurnErrorClass) {
    setRunning(cls);
    setResult(null);
    try {
      const res = await fetch(`/api/chat?simulate=${cls}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const text = await res.text();
      setResult({
        cls,
        status: res.status,
        shown: cls === "rate_limited" ? errorCopy.rateLimited : errorCopy.error,
        raw: elide(text),
      });
    } catch (err) {
      setResult({
        cls,
        status: 0,
        shown: errorCopy.error,
        raw: err instanceof Error ? err.message : "network error",
      });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-text-faint">
        Every way this site can fail, on demand. Each button takes the real exit in the
        chat route — no model is called, no budget is spent, and nothing here can produce
        an answer.
      </p>
      <div className="space-y-1">
        {FAILURES.map((f) => (
          <div key={f.cls} className="border border-line">
            <button
              type="button"
              onClick={() => run(f.cls)}
              disabled={running != null}
              className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-raised disabled:opacity-40"
            >
              <span className="text-text-soft">{f.cls}</span>
              <span className="ml-auto shrink-0 text-text-faint">{f.wire}</span>
              <span className="shrink-0 text-accent">{running === f.cls ? "…" : "run"}</span>
            </button>
            <p className="border-t border-line px-2 py-1.5 text-[10px] leading-relaxed text-text-faint">
              {f.cause}
            </p>
          </div>
        ))}
      </div>
      {result && (
        <div className="space-y-1 border border-line-strong p-2">
          <Row label="class" value={result.cls} emphasis />
          <Row label="http status" value={String(result.status)} />
          <div className="pt-1 text-[10px] text-text-faint">what you would have seen</div>
          <p className="text-[11px] leading-relaxed text-text-soft">{result.shown}</p>
          <div className="pt-1 text-[10px] text-text-faint">what came over the wire</div>
          <pre className="overflow-x-auto bg-raised p-2 text-[10px] leading-relaxed text-text-soft">
            {result.raw || "(empty body)"}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Trims a response body down to something readable in a 380px panel without
 * cutting the interesting end off. A streamed failure puts its error chunk LAST,
 * so a plain head-truncation would show everything except the point.
 */
function elide(body: string, keep = 2): string {
  const lines = body.trim().split("\n").filter(Boolean);
  if (lines.length <= keep * 2 + 1) return lines.join("\n");
  return [
    ...lines.slice(0, keep),
    `… ${lines.length - keep * 2} more lines …`,
    ...lines.slice(-keep),
  ].join("\n");
}

/** The last turn the server measured a rate for. */
export function lastSettledRate(turnLog: TurnRecord[]): number | null {
  for (let i = turnLog.length - 1; i >= 0; i -= 1) {
    const value = turnLog[i]?.timing?.tokensPerSecond;
    if (value != null) return value;
  }
  return null;
}

/** `anthropic/claude-haiku-4.5` → `claude-haiku-4.5`, for the one-line rows. */
function shortModel(model: string): string {
  return model.split("/").pop() ?? model;
}
