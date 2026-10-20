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
import {
  SIMULATABLE_CLASSES,
  TURN_FAILURES,
  turnErrorCopy,
  type TurnErrorClass,
} from "@/lib/chat-telemetry";
import { ALL_CHUNKS_BY_ID } from "@/lib/corpus";
import { DEFAULT_MODEL, MODEL_IDS, modelName } from "@/lib/models";
import { verifyAnswer, type Claim } from "@/lib/verify";
import type { Budget, TurnRecord } from "./use-conversation";
import type { TokenRate } from "./use-token-rate";

// The instrument deck: model picker, cost meter, tokens-per-second seismograph,
// per-turn trace, citation trace, failure theatre and teletype toggle.
//
// WHERE THIS LIVES is the constraint every choice here answers to. The
// instrumentation policy in docs/idea-decisions.md §4 puts density around the
// conversation, never in front of it, so a visitor who ignores every readout
// still has a working chatbot. The always-visible part is one line in the
// status strip (turns used and what the last answer cost). The rest opens in
// the context panel on a deliberate click, beside the conversation rather than
// over it. Every control is idempotent and every readout passive; the one
// control that makes a request, failure theatre, cannot produce an answer or
// spend the budget, and reports into its own box.

// ---------------------------------------------------------------------------
// Seismograph
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

  // The trace draws raw samples: the gaps between chunks are the interesting
  // part, and smoothing them away would misreport what arrived when. The
  // readout averages the last few samples, because a number that snaps to zero
  // whenever a chunk boundary falls between two samples is unreadable.
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

// Only the rate-limit headline comes from the shell. Every other class has its
// own sentence in `lib/chat-telemetry.ts`, which the deck reads directly.
export type ErrorCopy = { rateLimited: string };

export function InstrumentDeck({
  turnLog,
  budget,
  model,
  onModelChange,
  hydrated,
  rate,
  teletype,
  onToggleTeletype,
  errorCopy,
  answers,
}: {
  turnLog: TurnRecord[];
  budget: Budget | null;
  model: string;
  /** Selects who answers the next question. */
  onModelChange: (model: string) => void;
  hydrated: boolean;
  rate: TokenRate;
  teletype: boolean;
  onToggleTeletype: () => void;
  errorCopy: ErrorCopy;
  /** Every settled assistant answer's raw text, oldest first, markers intact. */
  answers: string[];
}) {
  const settled = lastSettledRate(turnLog);
  return (
    <div className="space-y-6">
      {/* Beside the meter it changes, under the names people call these
          models rather than raw Gateway ids. */}
      <Section title="Model" hint="for the next question">
        <label className="flex flex-col gap-1.5">
          <span className="sr-only">Model</span>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            // A native select is the one control that "works" before
            // hydration in the worst way: it opens, it takes a choice, and
            // the choice reaches nothing.
            disabled={!hydrated}
            className="min-h-[44px] w-full cursor-pointer border border-line-strong bg-raised px-2 text-[13px] text-text-soft outline-none focus:border-accent disabled:cursor-progress disabled:border-line disabled:text-text-dim"
          >
            {/* Catalogue order: the default first, then cheapest first. */}
            {MODEL_IDS.map((m) => (
              <option key={m} value={m}>
                {m === DEFAULT_MODEL ? `${modelName(m)} (default)` : modelName(m)}
              </option>
            ))}
          </select>
        </label>
        <p className="t-meta mt-2 text-text-faint">
          Every model spends from the same hourly budget, so switching changes what the
          meter below charges and nothing else. The id it runs under is{" "}
          <span className="text-text-soft">{model}</span>.
        </p>
      </Section>

      <Section title="Cost" hint={`est. at list price · checked ${PRICES_CHECKED}`}>
        <CostMeter turnLog={turnLog} budget={budget} model={model} />
      </Section>

      <Section title="Rate">
        <div className="t-meta flex items-center gap-3 text-text-faint">
          <Seismograph rate={rate} settled={settled} width={120} height={22} />
        </div>
        <p className="t-meta mt-2 text-text-faint">
          The live needle is sampled from the text as it arrives and marked{" "}
          <span className="text-text-soft">≈</span>. The number without one is the
          server&apos;s own measurement of the last finished turn.
        </p>
      </Section>

      <Section title="Trace" hint={`${turnLog.length} turn${turnLog.length === 1 ? "" : "s"}`}>
        <TraceInspector turnLog={turnLog} />
      </Section>

      <Section title="Citations" hint="checked by string comparison">
        <CitationTrace answers={answers} />
      </Section>

      <Section title="Failure theatre">
        <FailureTheatre errorCopy={errorCopy} />
      </Section>

      <Section title="Sound">
        <button
          type="button"
          onClick={onToggleTeletype}
          aria-pressed={teletype}
          className="border border-line-strong px-3 py-3 text-[13px] text-text-soft transition-colors hover:border-accent hover:text-accent"
        >
          teletype {teletype ? "on" : "off"}
        </button>
        <p className="t-meta mt-2 text-text-faint">
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
        <h3 className="text-[12px] text-text">{title}</h3>
        {hint && <span className="shrink-0 text-[12px] text-text-faint">{hint}</span>}
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
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="shrink-0 text-text-faint">{label}</span>
      {/* min-w-0 and break-words: the citation trace puts token lists and
          chunk ids here, which are longer than any number the deck had. */}
      <span
        className={`min-w-0 break-words text-right tabular-nums ${emphasis ? "text-accent" : "text-text-soft"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost meter
// ---------------------------------------------------------------------------

/**
 * The one home for everything budget-related: the hourly allowance, the answer
 * count, the dollars and the privacy note, rather than four separate surfaces.
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
          <Row label="hourly budget" value={`${budget.remaining}/${budget.limit} left`} />
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
          <div className="text-[12px] text-text-faint">last turn · {latest.model}</div>
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
        <p className="t-meta text-text-faint">
          No list price on file for {model}, so its turns are left out of the total rather
          than estimated.
        </p>
      )}

      <p className="t-meta text-text-faint">
        Estimated at published list price. The knowledge base is byte-identical on every
        request, so once it is cached that part of the input bills at a fraction of the
        fresh rate — the saving is the line above.
      </p>
      <p className="t-meta text-text-faint">
        Nothing you type is stored on the server. The conversation lives in this browser
        until you reset it, and the only thing kept server-side is a per-IP counter for the
        hourly limit.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Glass box
// ---------------------------------------------------------------------------

/**
 * Per-turn trace: every number recorded for each turn, including the two
 * latencies, which are deliberately not reconciled into one.
 */
function TraceInspector({ turnLog }: { turnLog: TurnRecord[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!turnLog.length) {
    return (
      <p className="t-meta text-text-faint">
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
                className="flex min-h-[44px] w-full items-baseline gap-2 px-2 py-2.5 text-left text-[12px] hover:bg-raised"
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
              {/* Opens by animating grid-template-rows from 0fr to 1fr (see
                  docs/beautiful-ui-port.md). The detail is twenty-odd lines of
                  variable height; a hard mount makes the panel below jump, and
                  animating a measured height needs a ref and a ResizeObserver.
                  The browser resolves 1fr against the real content on every
                  frame, so the height is never wrong. The inner overflow-hidden
                  is load-bearing: without it the content spills out of the 0fr
                  row and the row never appears to close. */}
              <div
                // Clipped, not unmounted, so without `inert` the collapsed
                // detail would stay in the accessibility tree and the tab order
                // under a control reporting aria-expanded="false".
                inert={!open}
                className="grid transition-[grid-template-rows,opacity] duration-300 ease-(--ease-out-strong)"
                style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
              >
                <div className="overflow-hidden">
                <div className="space-y-1 border-t border-line px-2 py-2">
                  <Row label="model" value={turn.model} />
                  <Row label="job posting" value={turn.jobPosting ? "yes" : "no"} />
                  {/* The only per-turn change to the system prompt, so the
                      only explanation for an input count that differs from
                      the turn before. */}
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
                    <summary className="cursor-pointer py-1 text-[12px] text-text-faint hover:text-accent">
                      raw record
                    </summary>
                    <pre className="mt-1 overflow-x-auto bg-raised p-2 text-[12px] leading-relaxed text-text-soft">
                      {JSON.stringify(turn, null, 2)}
                    </pre>
                  </details>
                </div>
                </div>
              </div>
            </div>
          );
        })}
      <p className="t-meta pt-1 text-text-faint">
        Two latencies on purpose: the server measures the model, the browser measures the
        wait. The gap between them is the network.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Citation trace
// ---------------------------------------------------------------------------

const VERDICT_LABEL: Record<Claim["verdict"], string> = {
  verified: "verified",
  miscited: "not in cited source",
  unverified: "not in the record",
  uncited: "uncited",
};

/**
 * Every checked sentence of every answer, with the tokens behind its verdict.
 * Under an answer a mis-citation is one faint line; here it is the sentence,
 * the tokens the cited chunk lacked and the chunks that do hold them, for the
 * visitor who wants to audit the check.
 */
function CitationTrace({ answers }: { answers: string[] }) {
  const checks = useMemo(
    () => answers.map((text) => verifyAnswer(text, ALL_CHUNKS_BY_ID)),
    [answers],
  );
  if (!checks.some((c) => c.claims.length)) {
    return (
      <p className="t-meta text-text-faint">
        Nothing checked yet. Every sentence that names a number or a proper noun is
        checked against the source it cites, and lands here.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {checks.map((check, i) =>
        check.claims.length ? (
          <div key={i} className="space-y-1 border border-line px-2 py-2">
            <Row
              label={`answer ${i + 1}`}
              value={`${check.verified}/${check.claims.length} verified`}
            />
            {check.claims
              .filter((c) => c.verdict !== "verified")
              .map((claim, j) => (
                <div key={j} className="border-t border-line pt-1.5 text-[12px] leading-[1.5]">
                  <div className={claim.verdict === "unverified" ? "text-accent" : "text-text-soft"}>
                    {VERDICT_LABEL[claim.verdict]}
                  </div>
                  <p className="t-meta text-text-faint">{claim.text}</p>
                  {claim.missing.length > 0 && (
                    <Row label="not in the cited chunk" value={claim.missing.join(", ")} />
                  )}
                  {claim.ids.length > 0 && <Row label="cited" value={claim.ids.join(", ")} />}
                  {claim.elsewhere.length > 0 && (
                    <Row label="found in" value={claim.elsewhere.slice(0, 3).join(", ")} />
                  )}
                  {claim.absent.length > 0 && (
                    <Row label="in no source" value={claim.absent.join(", ")} emphasis />
                  )}
                  {claim.unknownIds.length > 0 && (
                    <Row label="no such source" value={claim.unknownIds.join(", ")} emphasis />
                  )}
                </div>
              ))}
          </div>
        ) : null,
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Failure theatre
// ---------------------------------------------------------------------------

// One button per exit in app/api/chat/route.ts, read off the shared table in
// lib/chat-telemetry.ts rather than restated here. The first three are early
// failures with a status code; the rest are an HTTP 200 whose stream ends in an
// error chunk, which a client checking only `res.ok` would call a success.
//
// The `simulatable` filter leaves out `network`: it is raised in the browser
// before a request exists, so there is no server exit to take. It appears in
// the catch block in `run` below instead.
const FAILURES = SIMULATABLE_CLASSES.map((cls) => ({ cls, ...TURN_FAILURES[cls] }));

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
        // The same copy the conversation shows. Rate limiting is the exception:
        // the conversation renders ManualMode for it, and this is its headline.
        shown: cls === "rate_limited" ? errorCopy.rateLimited : turnErrorCopy(cls),
        raw: elide(text),
      });
    } catch (err) {
      setResult({
        cls,
        status: 0,
        // The button itself couldn't reach the server: the one class the route
        // can't simulate, because it happens before the route.
        shown: turnErrorCopy("network"),
        raw: err instanceof Error ? err.message : "network error",
      });
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="t-meta text-text-faint">
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
              className="flex min-h-[44px] w-full items-baseline gap-2 px-2 py-2.5 text-left text-[12px] hover:bg-raised disabled:text-text-dim"
            >
              <span className="text-text-soft">{f.cls}</span>
              <span className="ml-auto shrink-0 text-text-faint">{f.wire}</span>
              <span className="shrink-0 text-accent">{running === f.cls ? "…" : "run"}</span>
            </button>
            <p className="t-meta border-t border-line px-2 py-2 text-text-faint">
              {f.cause}
            </p>
          </div>
        ))}
      </div>
      {result && (
        <div className="space-y-1 border border-line-strong p-2">
          <Row label="class" value={result.cls} emphasis />
          <Row label="http status" value={String(result.status)} />
          <div className="pt-1 text-[12px] text-text-faint">what you would have seen</div>
          <p className="t-meta text-text-soft">{result.shown}</p>
          <div className="pt-1 text-[12px] text-text-faint">what came over the wire</div>
          <pre className="overflow-x-auto bg-raised p-2 text-[12px] leading-relaxed text-text-soft">
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
 * cutting the interesting end off. A streamed failure puts its error chunk
 * last, so a plain head-truncation would show everything except the point.
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

/** `openai/gpt-6-luna` → `gpt-6-luna`, for the one-line rows. */
function shortModel(model: string): string {
  return model.split("/").pop() ?? model;
}
