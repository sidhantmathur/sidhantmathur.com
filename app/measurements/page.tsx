import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/layout/doc-page";
import { latestRunPerModel } from "@/lib/model-comparison";
import { ANALYTICS, BUILT_AT, PUBLISHED_EVALS } from "@/lib/measurements.generated";
import {
  MIN_CLAIMS_FOR_RATE,
  MIN_TURNS_FOR_P50,
  MIN_TURNS_FOR_P95,
  formatDate,
  formatMs,
  formatPercent,
  groundedness,
  latencyReadout,
  successRate,
  type Maybe,
} from "@/lib/measurements";

// /measurements — roadmap Sprint 6. #2 (published eval suite), #23 (latency and
// reliability), #22 (groundedness self-report, gated on #2).
//
// Everything here is aggregated at BUILD time by scripts/build-measurements.mjs
// and rendered from a generated module, so the route is a static file like every
// other page on this site. Nothing is fetched per visit.
//
// Every section has a real empty state and reaches it by default. If the eval
// snapshot is missing or the analytics query found nothing, the section says
// which and shows no numbers. There is deliberately no sample data, no
// placeholder, and no last-known-good fallback anywhere in this file.

export const metadata: Metadata = {
  alternates: { canonical: "/measurements" },
  title: "What this assistant scores",
  description:
    "The published eval suite, the latency and reliability aggregate, and the groundedness self-report for the chat assistant on this site.",
};

const COPY = {
  intro:
    "Every instrument on this site measures one conversation — yours. This page is the aggregate: how the assistant scores against a fixed corpus, how fast and how reliably it answers, and how often its claims survive the site's own checker.",
  freshness:
    "All three are aggregated when the site is built, so they are exactly as old as the last deploy. Nothing on this page is fetched while you read it.",
  honesty:
    "Where a figure is derived, drawn from a small sample, or not measured at all, it says so beside itself rather than in a footnote. Sections with nothing behind them stay empty on purpose.",

  suiteHeading: "The eval suite",
  suiteIntro:
    "Two layers. The static layer runs on every change and needs no API key: it checks the knowledge base, the citation index, the system prompt's guard rails, the reconciler that decides what a job-description assessment is allowed to claim, and every export path. The live layer sends a fixed corpus of questions to a real running server and grades the answers.",
  suiteEmpty:
    "No run has been published yet. The suite exists and runs locally; publishing it is a deliberate step, so this stays empty until someone takes it.",
  suiteStaticNote:
    "These are assertions, not questions asked of a model — they pass or fail deterministically, and they are what stops a change quietly breaking something the answers depend on.",
  liveHeading: "Live runs",
  liveIntro:
    "The live corpus asks a real server real questions and checks the answers for specific evidence. It costs tokens and needs a key, so it is run deliberately and the result is committed rather than measured on every build.",
  liveEmpty:
    "No live run has been published yet.",
  liveNote:
    "A run is recorded per model, on the day it was run, and every run is kept. A turn that failed in transport is counted separately from one the model answered badly — they are different problems and collapsing them hides both.",
  liveCompare:
    "What each of these models cost and how fast it answered, plotted side by side:",

  latencyHeading: "Latency and reliability",
  latencyIntro:
    "Time to the first token of an answer, and how often a turn finishes at all, measured on the server across real conversations.",
  latencyNoCredentials:
    "This build had no analytics credentials, so there is nothing to aggregate. The events are being recorded; this deploy could not read them.",
  latencyNoEvents:
    "The analytics store answered and holds no chat turns in the window. Either nobody has used the assistant yet, or the events are not arriving — and this page cannot tell you which, so it will not guess.",
  latencyQueryFailed:
    "The analytics query failed while this site was being built, so this section has nothing to show. The build was not held up for it.",
  latencyNote:
    "Time to first token is the server's own measurement, with the network to your browser excluded. It is not how long the answer took to finish.",

  groundedHeading: "Groundedness",
  groundedIntro:
    "After every answer, a non-model checker takes each sentence that makes a checkable claim, reads the chunk of the record that sentence cited, and looks for the claim's numbers and proper nouns in it. A claim that cites nothing, or cites something that doesn't contain it, is marked in the margin of the answer you're reading.",
  groundedNarrow:
    "Verified means the numbers and names in a sentence appear in the source it named. It does not mean the sentence is true, and it says nothing about sentences with nothing checkable in them — those are not claims and are not counted.",
  groundedEmpty:
    "No live run has been published, so there is nothing to report. This number is deliberately read out of the eval snapshot and nowhere else: no run, no rate.",
  groundedCalibration:
    "The checker is tuned to under-report. Every false alarm a live run has produced — a discourse marker, a trailing comma inside a number, a derived word form, an abbreviated month, a compound written two ways — is pinned as a test in the static suite above, because a checker that cries wolf stops being read. The leniency runs one way on purpose: it reports absence, and a near-miss must never become an accusation.",
  groundedJdOnly:
    "Read the group above before reading the counts. The published runs cover the job-description flow only, and the closing prose after an assessment cites the record far less than an ordinary answer does — the evidence there travels in the requirement rows instead. So this is close to the least favourable sample the site could report, not a representative one.",
  groundedBlind:
    "It reads numbers and proper nouns, so an unfalsifiable sentence is invisible to it. And it has never been scored against a human-labelled sample of live answers — its accuracy is bounded by the calibration cases, not measured against a person.",
} as const;

/**
 * One sentence per reason the aggregate can be missing, keyed by the reason
 * rather than chained through a ternary — a record with a total key type means
 * a new reason is a type error here instead of silently inheriting whichever
 * sentence happened to be last. A blank section reads as "nothing is wrong",
 * which is the confusion these empty states exist to prevent.
 */
const UNAVAILABLE: Record<Exclude<typeof ANALYTICS, { available: true }>["reason"], string> = {
  "no-credentials": COPY.latencyNoCredentials,
  "no-events": COPY.latencyNoEvents,
  "query-failed": COPY.latencyQueryFailed,
};

export default function MeasurementsPage() {
  const evals = PUBLISHED_EVALS;
  // The snapshot archives EVERY run (Sprint 8), so a model measured twice
  // appears twice. Every aggregate here has to pick one run per model or it
  // double-counts that model — which would have silently inflated the
  // groundedness claim count the moment the archive shipped.
  const runs = latestRunPerModel(evals?.live.runs ?? []);
  const ground = groundedness(runs);

  return (
    <DocPage>
      <h1 className="text-[24px] font-medium tracking-[-0.02em] text-text">
        What this assistant scores
      </h1>
      <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-text-soft md:text-base">
        {COPY.intro}
      </p>
      <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-text-faint">
        {COPY.freshness} Built {formatDate(BUILT_AT)}.
      </p>
      <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-text-faint">
        {COPY.honesty}
      </p>

      {/* --- #2 -------------------------------------------------------- */}
      <Section heading={COPY.suiteHeading} intro={COPY.suiteIntro}>
        {!evals?.static ? (
          <Empty>{COPY.suiteEmpty}</Empty>
        ) : (
          <>
            <Figures>
              <Figure
                label="assertions"
                value={String(evals.static.totals?.tests ?? 0)}
                note={`${evals.static.totals?.passed ?? 0} passing`}
              />
              <Figure label="files" value={String(evals.static.files.length)} />
              <Figure label="run" value={formatDate(evals.static.ranAt)} />
              <Figure label="published" value={formatDate(evals.publishedAt)} />
            </Figures>
            <div className="mt-5 space-y-1">
              {evals.static.files.map((file) => (
                <details key={file.file} className="border-b border-line pb-1 last:border-b-0">
                  <summary className="cursor-pointer list-none py-1.5 text-[12px] text-text-soft transition-colors hover:text-accent">
                    <span className="tabular-nums text-text">{file.passed}</span>
                    <span className="text-text-faint">/{file.total}</span> {file.file}
                  </summary>
                  <div className="pb-2 pl-4">
                    {file.suites.map((suite) => (
                      <div key={suite.name} className="mt-2">
                        <div className="text-[11px] text-text-faint">
                          {suite.name}{" "}
                          <span className="tabular-nums">
                            {suite.passed}/{suite.total}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {suite.tests.map((name) => (
                            <li key={name} className="text-[12px] leading-relaxed text-text-soft">
                              {name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <Note>{COPY.suiteStaticNote}</Note>
          </>
        )}
      </Section>

      <Section heading={COPY.liveHeading} intro={COPY.liveIntro} level={3}>
        {!runs.length ? (
          <Empty>{COPY.liveEmpty}</Empty>
        ) : (
          <>
            <div className="mt-1">
              {runs.map((run) => (
                <div key={run.model} className="border-b border-line py-3 last:border-b-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[12px] text-text">{run.model}</span>
                    <span className="text-[11px] text-text-faint">{formatDate(run.ranAt)}</span>
                    <span className="text-[11px] text-text-soft tabular-nums">
                      {run.passed}/{run.total} passed
                    </span>
                    {run.broke > 0 && (
                      <span className="text-[11px] text-accent tabular-nums">
                        {run.broke} broke in transport
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-faint">
                    {Object.entries(run.groups).map(([group, g]) => (
                      <span key={group}>
                        {group}{" "}
                        <span className="tabular-nums text-text-soft">
                          {g.passed}/{g.total}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Note>
              {COPY.liveNote} {COPY.liveCompare}{" "}
              <Link href="/measurements/models" className="text-accent">
                Five models, one corpus
              </Link>
              .
            </Note>
          </>
        )}
      </Section>

      {/* --- #23 ------------------------------------------------------- */}
      <Section heading={COPY.latencyHeading} intro={COPY.latencyIntro}>
        {!ANALYTICS.available ? (
          <Empty>{UNAVAILABLE[ANALYTICS.reason]}</Empty>
        ) : (
          <>
            <Figures>
              <Figure
                label="turns measured"
                value={String(ANALYTICS.completedTurns + ANALYTICS.failedTurns)}
                note={`last ${ANALYTICS.windowDays} days`}
              />
              <MaybeFigure
                label="finished"
                maybe={successRate(ANALYTICS.completedTurns, ANALYTICS.failedTurns)}
                format={formatPercent}
              />
              <Figure label="failed" value={String(ANALYTICS.failedTurns)} />
            </Figures>

            <div className="mt-5">
              {ANALYTICS.models.map((model) => {
                const readout = latencyReadout(model);
                return (
                  <div key={model.model} className="border-b border-line py-3 last:border-b-0">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="text-[12px] text-text">{model.model}</span>
                      <span className="text-[11px] text-text-faint tabular-nums">
                        {readout.turns} turn{readout.turns === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      <Stat label="p50 first token" maybe={readout.p50Ms} format={formatMs} />
                      <Stat label="p95 first token" maybe={readout.p95Ms} format={formatMs} />
                      <Stat label="prompt cache hit" maybe={readout.cacheHitRate} format={formatPercent} />
                    </div>
                  </div>
                );
              })}
            </div>

            {ANALYTICS.byClass.length > 0 && (
              <div className="mt-5">
                <div className="text-[11px] text-text-faint">Failures by class</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-soft">
                  {ANALYTICS.byClass.map((c) => (
                    <span key={c.class}>
                      {c.class} <span className="tabular-nums text-text">{c.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Note>
              {COPY.latencyNote} A median is withheld under {MIN_TURNS_FOR_P50} turns and a 95th
              percentile under {MIN_TURNS_FOR_P95}, because below that they are a maximum wearing a
              percentile&apos;s name.
            </Note>
          </>
        )}
      </Section>

      {/* --- #22 ------------------------------------------------------- */}
      <Section heading={COPY.groundedHeading} intro={COPY.groundedIntro}>
        {!ground ? (
          <Empty>{COPY.groundedEmpty}</Empty>
        ) : (
          <>
            <Figures>
              <MaybeFigure
                label="claims verified"
                maybe={ground.rate}
                format={formatPercent}
                note={`${ground.verified} of ${ground.claims}`}
              />
              <Figure
                label="answers checked"
                value={String(ground.answers)}
                note={ground.groups.join(", ")}
              />
              <Figure label="invented sources" value={String(ground.inventedIds)} />
            </Figures>
            {ground.rate.reason === "too-few" && (
              <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-accent">
                Under {MIN_CLAIMS_FOR_RATE} published claims, so no rate is shown — {ground.verified}{" "}
                of {ground.claims} is a pair of counts, not a percentage anyone should carry away.
              </p>
            )}
            <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-text-faint">
              Measured on {ground.models.join(", ")}, over the {ground.groups.join(" and ")} group
              {ground.groups.length === 1 ? "" : "s"}.
            </p>
            {/*
              Naming the group isn't enough on its own: a reader has no way to
              know that job-posting turns cite differently from ordinary ones.
              Without this, the counts above read as the site's general
              groundedness, which they are not.
            */}
            {!ground.groups.includes("grounded") && (
              <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-text-soft">
                {COPY.groundedJdOnly}
              </p>
            )}
          </>
        )}
        <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-text-soft">
          {COPY.groundedNarrow}
        </p>
        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-text-faint">
          {COPY.groundedCalibration}
        </p>
        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-text-faint">
          {COPY.groundedBlind}
        </p>
      </Section>
    </DocPage>
  );
}

// --- pieces -----------------------------------------------------------------

function Section({
  heading,
  intro,
  level = 2,
  children,
}: {
  heading: string;
  intro: string;
  level?: 2 | 3;
  children: React.ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section className={level === 2 ? "mt-12 border-t border-line pt-8" : "mt-8"}>
      <Heading
        className={
          level === 2
            ? "text-[17px] font-medium tracking-[-0.01em] text-text"
            : "text-[14px] font-medium text-text"
        }
      >
        {heading}
      </Heading>
      <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-text-soft">{intro}</p>
      {children}
    </section>
  );
}

function Figures({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">{children}</div>;
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-[20px] tabular-nums leading-none text-text">{value}</div>
      <div className="mt-1.5 text-[11px] text-text-faint">{label}</div>
      {note && <div className="text-[11px] text-text-faint">{note}</div>}
    </div>
  );
}

/**
 * A figure the policy may have withheld. The withheld case renders an em dash
 * and the reason — never a zero, and never a number computed from a sample too
 * small to carry it.
 */
function MaybeFigure({
  label,
  maybe,
  format,
  note,
}: {
  label: string;
  maybe: Maybe<number>;
  format: (n: number) => string;
  note?: string;
}) {
  return (
    <div>
      <div className="text-[20px] tabular-nums leading-none text-text">
        {maybe.value == null ? "—" : format(maybe.value)}
      </div>
      <div className="mt-1.5 text-[11px] text-text-faint">{label}</div>
      {note && <div className="text-[11px] text-text-faint">{note}</div>}
      {maybe.value == null && (
        <div className="text-[11px] text-text-faint">
          {maybe.reason === "too-few" ? "too few to report" : "not measured"}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  maybe,
  format,
}: {
  label: string;
  maybe: Maybe<number>;
  format: (n: number) => string;
}) {
  return (
    <span className="text-text-faint">
      {label}{" "}
      <span className="tabular-nums text-text-soft">
        {maybe.value == null
          ? maybe.reason === "too-few"
            ? "— too few"
            : "— not measured"
          : format(maybe.value)}
      </span>
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-[62ch] border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-text-faint">
      {children}
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-[62ch] text-[12px] leading-relaxed text-text-faint">{children}</p>
  );
}
