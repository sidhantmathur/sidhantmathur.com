import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/layout/doc-page";
import { latestRunPerModel, measuredRange, splitArchive } from "@/lib/model-comparison";
import { ANALYTICS, BUILT_AT, PUBLISHED_EVALS } from "@/lib/measurements.generated";
import type { PublishedRun } from "@/lib/measurement-types";
import { DEFAULT_MODEL, MODEL_IDS } from "@/lib/models";
import {
  CHECKER_REVISED,
  MIN_CLAIMS_FOR_RATE,
  MIN_TURNS_FOR_P50,
  MIN_TURNS_FOR_P95,
  formatDate,
  formatMs,
  formatPercent,
  groundedness,
  checkedByCurrentRules,
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
  title: "How the assistant is measured",
  description:
    "The published eval suite, the latency and reliability aggregate, and the groundedness self-report for the chat assistant on this site.",
};

const COPY = {
  intro:
    "The readouts in the chat cover only your conversation. This page reports on the assistant as a whole: how it scores against a fixed set of questions, how fast and how reliably it answers, and how often its claims pass the site's own checker.",
  freshness:
    "All three are computed when the site is built, so they're only as current as the last deploy. Nothing on this page is fetched while you read it.",
  honesty:
    "If a figure is derived, comes from a small sample, or wasn't measured at all, the page says so next to it. A section with no data behind it stays empty and says why.",

  suiteHeading: "The eval suite",
  suiteIntro:
    "The suite has two layers. The static layer runs on every change and needs no API key. It checks the knowledge base, the citation index, the system prompt's guard rails, the reconciler that decides what a job-description assessment is allowed to claim, and every export path. The live layer sends a fixed set of questions to a running server and grades the answers.",
  suiteEmpty:
    "No run has been published yet. The suite runs locally, but publishing a run is a separate step, and this section stays empty until someone does it.",
  suiteStaticNote:
    "These checks don't call a model. Each one passes or fails the same way every time, and together they catch a change that would break something the answers depend on.",
  liveHeading: "Live runs",
  liveIntro:
    "The live layer sends the questions to a running server and checks each answer for specific evidence. It costs tokens and needs an API key, so it's run by hand, and each result is committed to the repo for the build to read.",
  liveEmpty:
    "No live run has been published yet.",
  liveCurrent: "The models the chat offers now, latest run of each",
  liveNoCurrent:
    "None of the models the chat offers now has a published run yet. The runs below were measured on models it offered before.",
  liveEarlier: "Earlier runs",
  liveEarlierNote:
    "Kept under the model each one ran on. Retired means the chat no longer offers that model, and none of its results carries over to the one that replaced it.",
  liveNote:
    "Each run is recorded under its model and the day it ran, and every run is kept. A turn that broke in transport is counted separately from one the model answered badly, because they're different problems.",
  liveCompare:
    "Each model's cost and speed are charted side by side in",

  latencyHeading: "Latency and reliability",
  latencyIntro:
    "How long an answer takes to start, as the server timed it, and how often a turn finishes at all, counted from the events visitors' browsers report.",
  latencyNoCredentials:
    "This build had no analytics credentials, so it couldn't read the chat's events or tell whether any were recorded.",
  latencyNoEvents:
    "The analytics store answered and holds no chat turns in the window. Either nobody has used the assistant yet or the events aren't arriving, and this page has no way to tell which.",
  latencyQueryFailed:
    "The analytics query failed while the site was being built, so this section has nothing to show. The build went ahead without it.",
  latencyNote:
    "Time to first token is measured on the server, so it leaves out the network between the server and your browser. It only covers how long the answer took to start.",

  groundedHeading: "Groundedness",
  groundedIntro:
    "After every answer, a text-matching checker (no model involved) takes each sentence that makes a checkable claim, reads the part of the record that sentence cited, and looks for the sentence's numbers and proper nouns in it. A claim that cites nothing, or cites a source that doesn't contain it, is marked on the answer in the chat.",
  groundedMeaning:
    "The first figure is the share of sentences with a checkable name or number where the checker found those names and numbers in the source the sentence cited. It isn't the share of statements that are true, and a sentence the checker couldn't match may still be correct.",
  groundedMeaningSplit: "The figures next to it show what happened to the rest.",
  groundedByModel: "Found in the cited source, by model:",
  groundedElsewhereNote: "in the record, under a different source",
  groundedAbsentNote: "can include a sentence naming what the record lacks, or a word taken for a name",
  groundedRules:
    "A name or number found elsewhere in the record is now counted separately from one found nowhere, numbers only match as whole numbers, and a sentence that only names a gap isn't checked any more.",
  groundedRulesAbove: "Every run counted above was scored after the change.",
  groundedEarlierLead:
    "Runs from before the change were scored by the older rules, so they're counted separately.",
  groundedNarrow:
    "Found in the cited source means the numbers and names in a sentence appear in the source it named. It doesn't mean the sentence is true. Sentences with nothing checkable in them aren't treated as claims and aren't counted.",
  groundedNoCurrent:
    "None of the models the chat offers now has a run scored by the current checker, so there's no current figure. Earlier runs are below, counted separately.",
  groundedEmpty:
    "No live run has been published, so there's no rate to report. It's computed only from published eval runs.",
  groundedCalibration:
    "The checker is tuned to under-report, because people learn to ignore marks that flag correct sentences. Every false alarm a live run has produced (a discourse marker, a trailing comma inside a number, a derived word form, an abbreviated month, a compound written two ways) is now a test in the static suite above. A mark only says that something wasn't found.",
  groundedJdOnly:
    "The published runs cover only the job-description flow. The closing text after an assessment cites the record far less than an ordinary answer does, because the evidence is in the requirement rows. So this sample is close to the least favourable one the site could report, and it doesn't represent ordinary answers.",
  groundedBlind:
    "The checker only reads numbers and proper nouns, so a claim with neither in it never gets checked. It has also never been tested against live answers labelled by a person. The calibration cases are the only evidence of its accuracy.",
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
  //
  // And it keeps runs of models the chat has since dropped. Those stay on the
  // record under their own ids, but they are not the assistant as it runs now,
  // so the headline reads the models on offer and lists the rest as history.
  const archive = evals?.live.runs ?? [];
  const { current: runs, earlier, retired } = splitArchive(archive, MODEL_IDS);
  const retiredSet = new Set(retired);
  // Groundedness adds counts across runs, so it may only add runs the same
  // checker scored. Today's runs and July's were scored by different rules
  // (CHECKER_REVISED), and a sum across both would be a number neither set of
  // rules produced.
  const scored = runs.filter(checkedByCurrentRules);
  const unscored = runs.filter((r) => !checkedByCurrentRules(r));
  const ground = groundedness(scored);
  const before = archive.filter((r) => !checkedByCurrentRules(r));
  const groundBefore = groundedness(latestRunPerModel(before));

  return (
    <DocPage>
      <h1 className="t-title font-medium text-text">
        How the assistant is measured
      </h1>
      <p className="t-body mt-6 max-w-[62ch] text-text-soft">
        {COPY.intro}
      </p>
      <p className="t-body mt-4 max-w-[62ch] text-text-faint">
        {COPY.freshness} Built {formatDate(BUILT_AT)}.
      </p>
      <p className="t-body mt-2 max-w-[62ch] text-text-faint">
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
                  <summary className="t-meta cursor-pointer list-none py-2 text-text-soft transition-colors hover:text-accent">
                    <span className="tabular-nums text-text">{file.passed}</span>
                    <span className="text-text-faint">/{file.total}</span> {file.file}
                  </summary>
                  <div className="pb-2 pl-4">
                    {file.suites.map((suite) => (
                      <div key={suite.name} className="mt-2">
                        <div className="t-meta text-text-faint">
                          {suite.name}{" "}
                          <span className="tabular-nums">
                            {suite.passed}/{suite.total}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {suite.tests.map((name) => (
                            <li key={name} className="t-meta text-text-soft">
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
        {!archive.length ? (
          <Empty>{COPY.liveEmpty}</Empty>
        ) : (
          <>
            <div className="t-label mt-5 text-text-faint">{COPY.liveCurrent}</div>
            {!runs.length ? (
              <Empty>{COPY.liveNoCurrent}</Empty>
            ) : (
              <div className="mt-1">
                {runs.map((run) => (
                  <div key={run.model} className="border-b border-line py-3 last:border-b-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="t-meta text-text">{run.model}</span>
                      {run.model === DEFAULT_MODEL && (
                        <span className="t-meta text-accent">default</span>
                      )}
                      <span className="t-meta text-text-faint">{formatDate(run.ranAt)}</span>
                      <span className="t-meta text-text-soft tabular-nums">
                        {run.passed}/{run.total} passed
                      </span>
                      {run.broke > 0 && (
                        <span className="t-meta text-accent tabular-nums">
                          {run.broke} broke in transport
                        </span>
                      )}
                    </div>
                    <div className="t-meta mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-text-faint">
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
            )}

            {earlier.length > 0 && (
              <>
                <div className="t-label mt-6 text-text-faint">{COPY.liveEarlier}</div>
                <p className="t-meta mt-1 max-w-[62ch] text-text-faint">{COPY.liveEarlierNote}</p>
                <ul className="mt-2">
                  {earlier.map((run) => (
                    <li
                      key={`${run.model}@${run.ranAt}`}
                      className="t-meta flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line py-2 font-mono last:border-b-0"
                    >
                      <span className="text-text-soft">{run.model}</span>
                      {retiredSet.has(run.model) && (
                        <span className="text-text-faint">retired</span>
                      )}
                      <span className="text-text-faint">{formatDate(run.ranAt)}</span>
                      <span className="tabular-nums text-text-soft">
                        {run.passed}/{run.total} passed
                      </span>
                      {run.broke > 0 && (
                        <span className="tabular-nums text-text-faint">
                          {run.broke} broke in transport
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Note>
              {COPY.liveNote} {COPY.liveCompare}{" "}
              <Link href="/measurements/models" className="text-accent">
                the model comparison
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
                      <span className="t-meta text-text">{model.model}</span>
                      <span className="t-meta text-text-faint tabular-nums">
                        {readout.turns} turn{readout.turns === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="t-meta mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
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
                <div className="t-label text-text-faint">Failures by class</div>
                <div className="t-meta mt-1 flex flex-wrap gap-x-4 gap-y-1 text-text-soft">
                  {ANALYTICS.byClass.map((c) => (
                    <span key={c.class}>
                      {c.class} <span className="tabular-nums text-text">{c.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Note>
              {COPY.latencyNote} A median isn&apos;t shown under {MIN_TURNS_FOR_P50} turns, or a 95th
              percentile under {MIN_TURNS_FOR_P95}, because samples that small can&apos;t support
              them.
            </Note>
          </>
        )}
      </Section>

      {/* --- #22 ------------------------------------------------------- */}
      <Section heading={COPY.groundedHeading} intro={COPY.groundedIntro}>
        {!ground ? (
          <Empty>{groundBefore ? COPY.groundedNoCurrent : COPY.groundedEmpty}</Empty>
        ) : (
          <>
            <Figures grid>
              {/*
                The lead figure was labelled "claims verified" until
                2026-10-20, and 52.8% under that label read to a visitor as
                "half of what it says about him is false". The number was
                honest and the label let it be misread, so the label now says
                where the names and numbers were found, the sentence under the
                row says what the share is and isn't, and the figures beside it
                say what happened to the rest.
              */}
              <MaybeFigure
                label="found in the cited source"
                maybe={ground.rate}
                format={formatPercent}
                note={`${ground.verified} of ${ground.claims} checkable sentences`}
              />
              {ground.verdicts && (
                <>
                  <Figure
                    label="found elsewhere in the record"
                    value={String(ground.verdicts.miscited)}
                    note={COPY.groundedElsewhereNote}
                  />
                  <Figure
                    label="not found in the record"
                    value={String(ground.verdicts.unverified)}
                    note={COPY.groundedAbsentNote}
                  />
                  <Figure label="cited no source" value={String(ground.verdicts.uncited)} />
                </>
              )}
              <Figure label="invented sources" value={String(ground.inventedIds)} />
              <Figure
                label="answers checked"
                value={String(ground.answers)}
                note={ground.groups.join(", ")}
              />
            </Figures>
            <p className="t-body mt-5 max-w-[62ch] text-text-soft">
              {COPY.groundedMeaning}
              {ground.verdicts && ` ${COPY.groundedMeaningSplit}`}
            </p>
            {ground.rate.reason === "too-few" && (
              <p className="t-body mt-4 max-w-[62ch] text-accent">
                With fewer than {MIN_CLAIMS_FOR_RATE} checkable sentences published, the page shows no
                rate. {ground.verified} of {ground.claims} is too small a sample to turn into a
                percentage.
              </p>
            )}
            <p className="t-body mt-4 max-w-[62ch] text-text-faint">
              Measured on the latest run of each model the chat offers,{" "}
              {measuredRange(datesOf(scored))}, over the {listOf(ground.groups)} group
              {ground.groups.length === 1 ? "" : "s"}.
            </p>
            <div className="t-meta mt-2 flex flex-wrap gap-x-4 gap-y-1 text-text-faint">
              <span>{COPY.groundedByModel}</span>
              {scored.map((run) => (
                <span key={run.model}>
                  {run.model}
                  {run.model === DEFAULT_MODEL && " (default)"}{" "}
                  <span className="tabular-nums text-text-soft">
                    {run.citations.verified} of {run.citations.claims}
                  </span>
                </span>
              ))}
            </div>
            {unscored.length > 0 && (
              <p className="t-meta mt-2 max-w-[62ch] text-text-faint">
                Not counted: {unscored.map((r) => r.model).join(", ")}, whose latest run predates
                the change described below.
              </p>
            )}
            {/*
              Naming the group isn't enough on its own: a reader has no way to
              know that job-posting turns cite differently from ordinary ones.
              Without this, the counts above read as the site's general
              groundedness, which they are not.
            */}
            {!ground.groups.includes("grounded") && (
              <p className="t-body mt-3 max-w-[62ch] text-text-soft">
                {COPY.groundedJdOnly}
              </p>
            )}
          </>
        )}
        <p className="t-body mt-4 max-w-[62ch] text-text-soft">
          The checker&apos;s rules changed on {formatDate(CHECKER_REVISED)}. {COPY.groundedRules}
          {ground && ` ${COPY.groundedRulesAbove}`}
        </p>
        {groundBefore && (
          <p className="t-body mt-3 max-w-[62ch] text-text-faint">
            {COPY.groundedEarlierLead} The latest of those runs on each model found{" "}
            {groundBefore.verified} of {groundBefore.claims} checkable sentences in the cited source
            {groundBefore.rate.value != null && ` (${formatPercent(groundBefore.rate.value)})`},
            across {groundBefore.models.length} model{groundBefore.models.length === 1 ? "" : "s"}{" "}
            measured {measuredRange(datesOf(latestRunPerModel(before)))}
            {ground ? ", and that figure can't be compared with the one above." : "."}
          </p>
        )}
        <p className="t-body mt-4 max-w-[62ch] text-text-soft">
          {COPY.groundedNarrow}
        </p>
        <p className="t-body mt-3 max-w-[62ch] text-text-faint">
          {COPY.groundedCalibration}
        </p>
        <p className="t-body mt-3 max-w-[62ch] text-text-faint">
          {COPY.groundedBlind}
        </p>
      </Section>
    </DocPage>
  );
}

// --- pieces -----------------------------------------------------------------

/** ["a", "b", "c"] → "a, b and c". */
function listOf(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Run dates, earliest first, for `measuredRange`. Undated runs are left out. */
function datesOf(runs: PublishedRun[]): string[] {
  return runs
    .map((r) => r.ranAt)
    .filter((d): d is string => !!d)
    .sort();
}

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
            ? "t-head font-medium text-text"
            : "t-meta font-medium text-text"
        }
      >
        {heading}
      </Heading>
      <p className="t-body mt-3 max-w-[62ch] text-text-soft">{intro}</p>
      {children}
    </section>
  );
}

/**
 * A row of figures. `grid` keeps a longer set in fixed columns, so one figure
 * with a long note can't leave another stranded on a row by itself.
 */
function Figures({ children, grid = false }: { children: React.ReactNode; grid?: boolean }) {
  return (
    <div
      className={
        grid
          ? "mt-5 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3"
          : "mt-5 flex flex-wrap gap-x-8 gap-y-4"
      }
    >
      {children}
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-[20px] tabular-nums leading-none text-text">{value}</div>
      <div className="t-label mt-1.5 text-text-faint">{label}</div>
      {note && <div className="t-meta max-w-[30ch] text-text-faint">{note}</div>}
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
      <div className="t-label mt-1.5 text-text-faint">{label}</div>
      {note && <div className="t-meta max-w-[30ch] text-text-faint">{note}</div>}
      {maybe.value == null && (
        <div className="t-meta text-text-faint">
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
    <p className="t-body mt-4 max-w-[62ch] border-l-2 border-line-strong pl-3 text-text-faint">
      {children}
    </p>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="t-meta mt-4 max-w-[62ch] text-text-faint">{children}</p>
  );
}
