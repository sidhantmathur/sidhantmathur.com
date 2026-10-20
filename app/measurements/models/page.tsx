import type { Metadata } from "next";
import Link from "next/link";

import { ScrollFade, floorWidth } from "@/components/charts/chart-frame";
import { FrontierScatter } from "@/components/charts/frontier-scatter";
import { RankedBars } from "@/components/charts/ranked-bars";
import { ScorecardHeatmap } from "@/components/charts/scorecard-heatmap";
import { DocPage } from "@/components/layout/doc-page";
import { BUILT_AT, PUBLISHED_EVALS } from "@/lib/measurements.generated";
import type { PublishedRun } from "@/lib/measurement-types";
import { MIN_TURNS_FOR_P50, formatDate, formatPercent } from "@/lib/measurements";
import {
  allGroups,
  bakeoffSummary,
  catalogueDrift,
  formatCost,
  formatCount,
  formatSeconds,
  formatTurnCost,
  frontier,
  median,
  rank,
  runHistory,
  splitArchive,
  toRow,
  type ModelRow,
} from "@/lib/model-comparison";
import {
  DEFAULT_MODEL,
  MODEL_IDS,
  modelName,
  reasoningFor,
  type ReasoningLevel,
} from "@/lib/models";
import { PRICES_CHECKED, PRICE_CONFIDENCE } from "@/lib/pricing";

// /measurements/models — the model bake-off (roadmap Sprint 8).
//
// Every model the chat offers, run against the same 22-case corpus, back to
// back, against the same server. What that produces is the artifact the
// eval harness was always generating and then throwing away: quality against
// cost, quality against latency, and the token and timing detail underneath.
//
// Like the rest of /measurements this is aggregated at BUILD time from the
// committed snapshot and rendered from a generated module, so the route is a
// static file. Nothing is fetched per visit and there is no client JavaScript
// in any chart — hover is a native SVG <title>, and every value a tooltip shows
// is also printed on the page or in the table.
//
// THIS IS A RUN-ONCE ARTIFACT, NOT A DASHBOARD. It was measured deliberately on
// a date, it is committed, and it goes stale. The page says the date rather than
// implying freshness it does not have.
//
// The chat's catalogue moves on without it. The charts compare only the models
// the chat offers now (`splitArchive`). A model it has dropped keeps every run in
// the archive section, under its own id and marked retired, and none of its
// figures is handed to the model that replaced it. Which models are retired,
// and which offered ones were never measured, comes from the catalogue rather
// than from prose.

export const metadata: Metadata = {
  alternates: { canonical: "/measurements/models" },
  title: "Five models, one corpus",
  description:
    "The five models this site's chat offers, measured against the same eval corpus: pass rate, time to first token, output speed, tokens and cost per task.",
};

const COPY = {
  intro:
    "The chat on this site can run several models. For this page, each one it offers now answered the same 22 questions, in the same order, against the same server, in one sitting. The same checker graded every answer, and every cost is at list price.",
  archiveLead:
    "Earlier runs are kept in the archive at the end of the page, each under the model it ran on. None of their figures carries over to a successor, and none is in the charts.",
  why: "Choosing a model is a trade between how often the answer is right, how long you wait for it, how much of it you get, and what it costs. Those pull against each other, and you can only see the trade when all four are measured on the same corpus.",
  noCurrent:
    "None of the models the chat offers now has a published run yet, so there is nothing to compare. Earlier runs, on models it offered before, are in the archive below.",
  empty:
    "No live run has been published, so there is nothing to compare. The bake-off runs locally, and this page stays empty until someone publishes a run.",

  frontierHeading: "Quality against cost",
  frontierNote:
    "Median list-price cost of one graded turn, against the share of answered cases that passed. Better is up; cheaper is left. Turns that broke mid-stream aren't counted as wrong answers. They have their own panel below.",
  latencyHeading: "Quality against latency",
  latencyNote:
    "Median time to the model's first token, against the share of answered cases that passed. Better is up; faster is left.",

  panelsHeading: "The numbers underneath",
  panelsIntro:
    "Each panel plots one measurement, sorted best first. Where one model is best, its bar is the only one in the accent colour. In output tokens per turn neither end is better, so nothing is highlighted. A longer answer costs more without being better.",

  scorecardHeading: "The scorecard",
  scorecardIntro:
    "Pass rate by model and by what each group tests. There's no overall score, because a model that answers grounded questions well but falls for prompt injection is a different problem from one that's mediocre at both, and a single number can't tell them apart.",
  groupsNote:
    "grounded checks that the model states facts that are in the corpus, and says 'I don't have that' when they aren't. refusal checks that it turns down out-of-scope requests. injection covers role override, prompt extraction, knowledge-base dump, a fake system message, disparagement bait and persona hijack. roleFit is pasted job descriptions, graded on whether the assessment names the gaps or flatters the reader.",

  tableHeading: "Everything, as a table",
  tableIntro:
    "The figures from the scatter plots and panels above, plus some no chart shows. Nothing in this table depends on colour or hover.",

  archiveHeading: "The run archive",
  archiveIntro:
    "Every published run, by model, with the date it was measured. A second run on a model used to overwrite the first, so a regression didn't show and a figure measured twice looked the same as one measured once. Now every run is kept. The charts above use the latest run of each model the chat offers. A retired model is one the chat no longer offers, and its runs stay here under its own id.",

  limitsHeading: "What this does not measure",
} as const;

const LIMITS = [
  {
    id: "sample",
    title: "One sample per case",
    body: "In the run charted here, each model answered each question once. Every timing figure is a median over about twenty turns. That's enough to rank the models but far too few for a 95th percentile, so none is computed. Re-running the same corpus on the same model would move these numbers.",
  },
  {
    title: "Latency depends on the connection and the day",
    body: "Time to first token is measured on the server, so the browser's network isn't in it. The hop from a home connection to the provider is, and so is whatever load the provider was under at that hour. Read it as what these requests took that day, not as the model's speed inside a datacentre.",
  },
  {
    title: "The grader checks for specific text",
    body: "A case passes when the answer contains specific evidence, like a name, a number or a refusal. That keeps grading free and repeatable, but it also means a wrong answer containing the right number still passes, and a right answer phrased oddly can fail. The checks are there to catch regressions, and a pass rate here isn't a measure of accuracy.",
  },
  {
    id: "cost",
    title: "Costs are list-price estimates",
    body: "Every dollar figure is the tokens the run used, priced at the list rates on record when the run was published. It's an estimate, and it isn't recomputed when a price changes. DeepSeek V4 Flash's rate is unconfirmed. The Gateway serves it through many providers whose rates differ several times over, and the meter can't see which one billed a turn. Archived runs keep the rates of their day, and two of those have since been corrected: gpt-5.6-luna's July run was costed at an unconfirmed $1.00 in and $6.00 out per million tokens, five times what the Gateway later published, and gemini-3.5-flash-lite's cache reads at a derived rate two and a half times the published one.",
  },
  {
    title: "Broken turns are counted separately from wrong answers",
    body: "Some turns died mid-stream and never produced an answer. They're left out of the pass rate, because a dropped connection says nothing about the model's judgment, and they get their own panel. One sitting is a small sample for a reliability claim, though. It shows that a model dropped streams here on that day, but can't say how often it drops them elsewhere.",
  },
  {
    id: "settings",
    title: "Each model runs the way the chat runs it",
    body: "Each model answered with the settings the chat gives it. This measures the site as a visitor would find it, and doesn't try to get the best out of each model.",
  },
  {
    title: "Token counts are each provider's own",
    body: "Every model got byte-identical prompts, so most of the spread in input tokens comes from each tokenizer counting the same text differently. Seconds and dollars compare across models, but token counts don't.",
  },
  {
    title: "The corpus is narrow",
    body: "Twenty-two cases about one person's resume, and the ways someone might try to break a chatbot that answers questions about it. That's the workload this site runs, so the numbers are useful here but won't transfer to yours.",
  },
] as const;

/**
 * What the Gateway actually charged for a run, where someone read it: the
 * account's `total_used` (GET https://ai-gateway.vercel.sh/v1/credits) just
 * before and just after that model's run. The runner cannot see billing, so
 * this is not in the snapshot. Each entry is keyed to the exact run it
 * describes, so a later bake-off falls out of it rather than inheriting it.
 * The key is shared with production; four of five runs billing within a cent
 * of their list-price total is the evidence nothing else spent in between.
 * Source: docs/followups.md §2, "The bake-off, 2026-10-20".
 */
const GATEWAY_BILLED_USD: Record<string, number> = {
  "openai/gpt-6-luna@2026-10-20T02:30:11.977Z": 0.00686,
  "deepseek/deepseek-v4-flash-0731@2026-10-20T02:32:16.980Z": 0.03679,
  "anthropic/claude-haiku-5.5@2026-10-20T02:37:50.391Z": 0.01755,
  "openai/gpt-5-mini@2026-10-20T02:39:30.390Z": 0.08054,
  "google/gemini-3.5-flash-lite@2026-10-20T02:45:42.374Z": 0.09141,
};

/**
 * The charted runs whose Gateway bill is on record, and the ones that bill did
 * not match. Null unless every charted run has one: "the bill matched for these
 * three" would read as "for all of them".
 */
function billedAgainstList(rows: ModelRow[]) {
  const billed = rows.map((r) => ({ row: r, usd: GATEWAY_BILLED_USD[`${r.model}@${r.ranAt}`] }));
  if (!billed.every((b) => b.usd != null && b.row.costTotalUsd != null)) return null;
  // Within half a tenth of a cent or 5%: the meter and the bill round differently.
  const off = billed.filter(
    (b) => Math.abs(b.usd - b.row.costTotalUsd!) > Math.max(0.0005, 0.05 * b.row.costTotalUsd!),
  );
  return { off: off.map((b) => ({ model: b.row.model, billed: b.usd, list: b.row.costTotalUsd! })) };
}

export default function ModelComparisonPage() {
  const snapshot = PUBLISHED_EVALS;
  const archive = snapshot?.live.runs ?? [];
  // The charts compare the models on offer and nothing else. A run of a model
  // the chat has dropped is real and stays on the record, but beside today's
  // five it would be a comparison nobody ran.
  const { current, earlier, retired } = splitArchive(archive, MODEL_IDS);
  const rows = current.map(toRow);
  const groups = allGroups(rows);

  if (!rows.length) {
    return (
      <DocPage>
        <Header />
        <p className="t-body mt-8 max-w-[62ch] border-l-2 border-line-strong pl-3 text-text-faint">
          {archive.length ? COPY.noCurrent : COPY.empty}
        </p>
        {archive.length > 0 && <Archive archive={archive} current={current} retired={retired} />}
      </DocPage>
    );
  }

  const summary = bakeoffSummary(rows);
  const notMeasured = catalogueDrift(
    rows.map((r) => r.model),
    MODEL_IDS,
  ).notMeasured;
  // A model run more than once on the day it was charted, on the same corpus.
  // The nearest thing to a variance figure a one-sample-per-case bake-off has,
  // computed from the archive rather than typed into the caveat.
  const repeats = current.flatMap((run) => {
    const day = formatDate(run.ranAt);
    const same = archive
      .filter((r) => r.model === run.model && r.total === run.total && formatDate(r.ranAt) === day)
      .sort((a, b) => String(a.ranAt).localeCompare(String(b.ranAt)));
    return same.length > 1
      ? [{ model: run.model, date: day, total: run.total, passed: same.map((r) => r.passed) }]
      : [];
  });
  // Read from the catalogue, so the caveat cannot drift from what the route sends.
  const tuned = rows.flatMap((r) => {
    const id = MODEL_IDS.find((m) => m === r.model);
    if (!id) return [];
    return [
      { turn: "on ordinary turns", level: reasoningFor(id, { jobPosting: false }) },
      { turn: "on a pasted job posting", level: reasoningFor(id, { jobPosting: true }) },
    ].flatMap((t) => (t.level ? [{ model: r.model, ...t, level: t.level }] : []));
  });
  const bill = billedAgainstList(rows);
  const cost = frontier(rows, (r) => r.costPerTaskUsd, (r) => r.passRate);
  const latency = frontier(rows, (r) => median(r.ttftMs), (r) => r.passRate);

  return (
    <DocPage>
      <Header />

      <p className="t-body mt-6 max-w-[62ch] text-text-soft">
        {COPY.intro}
      </p>
      <p className="t-body mt-4 max-w-[62ch] text-text-soft">{COPY.why}</p>
      <p className="t-body mt-4 max-w-[62ch] text-text-faint">
        Measured {summary.measuredRange}. Published {formatDate(snapshot?.publishedAt)}, built into
        this page{" "}
        {formatDate(BUILT_AT)}. The comparison was run once and doesn&apos;t update, so it will
        go out of date.
      </p>
      {(earlier.length > 0 || notMeasured.length > 0) && (
        <div className="t-body mt-4 max-w-[62ch] border-l-2 border-line-strong pl-3 text-text-soft">
          {earlier.length > 0 && <p>{COPY.archiveLead}</p>}
          {retired.length > 0 && (
            <p className="mt-2">
              Retired, measured earlier: <ModelList ids={retired} />.
            </p>
          )}
          {notMeasured.length > 0 && (
            <p className="mt-2">
              Offered now, not measured yet:{" "}
              <ModelList ids={notMeasured} />.
            </p>
          )}
        </div>
      )}

      {/* --- the sample everything below rests on ----------------------- */}
      <div className="mt-8 border-t border-line pt-6">
        <div className="t-label text-text-faint">turns graded</div>
        <div className="text-[44px] leading-none text-text">{summary.turnsGraded}</div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
          <Figure label="models" value={String(rows.length)} />
          <Figure
            label="cases each"
            value={summary.uniformCorpus ? String(summary.casesEach) : "varies"}
            note={summary.uniformCorpus ? "the same corpus" : "runs cover different case counts"}
          />
          <Figure label="eval groups" value={String(groups.length)} />
          <Figure
            label="broke mid-stream"
            value={String(summary.turnsBroke)}
            note="never produced an answer"
          />
          <Figure
            label="cost of the whole comparison"
            value={formatCost(summary.totalCost, 2)}
            note="list price, every turn"
          />
        </div>
      </div>

      {/* --- the two frontiers ------------------------------------------ */}
      <Section heading={COPY.frontierHeading}>
        <FrontierScatter
          heading="Pass rate against median cost per turn"
          note={
            bill?.off.length
              ? `${COPY.frontierNote} ${bill.off
                  .map(
                    (o) =>
                      `${modelName(o.model)}'s Gateway bill was ${(o.billed / o.list).toFixed(1)} times its list-price total, so at the billed cost its dot would sit further right`,
                  )
                  .join("; ")}. The figures are in the note on list prices below.`
              : COPY.frontierNote
          }
          plot={cost}
          xLabel="median cost per turn (log)"
          xScale="log"
          formatX={formatTurnCost}
        />
      </Section>

      <Section heading={COPY.latencyHeading}>
        <FrontierScatter
          heading="Pass rate against median time to first token"
          note={COPY.latencyNote}
          plot={latency}
          xLabel="median time to first token"
          xScale="linear"
          formatX={(v) => formatSeconds(v)}
        />
      </Section>

      {/* --- the ranked panels ------------------------------------------ */}
      <Section heading={COPY.panelsHeading} intro={COPY.panelsIntro}>
        <div className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          <RankedBars
            heading="Time to first token"
            note="Median, server-measured. Lower is better."
            bestLabel="fastest"
            format={formatSeconds}
            ranked={rank(rows, (r) => median(r.ttftMs), "lower")}
          />
          <RankedBars
            heading="Output speed"
            note="Median output tokens per second across the turn. Higher is better."
            bestLabel="fastest"
            format={(v) => `${v.toFixed(1)} tok/s`}
            ranked={rank(rows, (r) => median(r.tokensPerSecond), "higher")}
          />
          <RankedBars
            heading="Cost per turn"
            note="Median, at list price when the run was published. Lower is better."
            bestLabel="cheapest"
            format={formatTurnCost}
            ranked={rank(rows, (r) => r.costPerTaskUsd, "lower")}
          />
          <RankedBars
            heading="Output tokens per turn"
            note="Median. Neither end is better. More tokens means a longer answer and a bigger output bill. Each provider counts with its own tokenizer, so the counts don't line up exactly across models."
            format={(v) => formatCount(v)}
            ranked={rank(rows, (r) => median(r.outputTokens), "none")}
          />
          <RankedBars
            heading="Input tokens per turn"
            note="Median. Every model got the same prompts, so most of this spread is each tokenizer counting the same text differently. These counts don't compare across providers the way seconds and dollars do."
            bestLabel="fewest"
            format={(v) => formatCount(v)}
            ranked={rank(rows, (r) => median(r.inputTokens), "lower")}
          />
          <RankedBars
            heading="Turns that broke"
            note="Share of attempted turns that failed in transport or died mid-stream, so the model never produced an answer. Lower is better. These turns aren't in the pass rate above."
            bestLabel="most reliable"
            format={(v) => formatPercent(v)}
            ranked={rank(rows, (r) => r.breakRate, "lower")}
          />
          <RankedBars
            heading="Prompt cache hit rate"
            note="Share of input tokens (not turns) served from the provider's cache. Higher is cheaper."
            bestLabel="best"
            format={(v) => formatPercent(v)}
            ranked={rank(rows, (r) => r.cacheHitRate, "higher")}
          />
        </div>
      </Section>

      {/* --- the scorecard ---------------------------------------------- */}
      <Section heading={COPY.scorecardHeading} intro={COPY.scorecardIntro}>
        <ScorecardHeatmap rows={rows} groups={groups} />
        <Note>{COPY.groupsNote}</Note>
      </Section>

      {/* --- the table -------------------------------------------------- */}
      <Section heading={COPY.tableHeading} intro={COPY.tableIntro}>
        <ScrollFade width={820} className="mt-4" label={COPY.tableHeading}>
          <table className={`t-meta w-full ${floorWidth(820)} text-left`}>
            {/* Twelve columns of numbers deserve a sentence saying what the
                rows are, the way the scorecard's table already has one. */}
            <caption className="sr-only">{COPY.tableIntro}</caption>
            <thead className="t-label text-text-faint">
              <tr className="border-b border-line">
                {[
                  "model",
                  "passed / answered",
                  "broke",
                  "p50 TTFT",
                  "tok/s",
                  "in",
                  "out",
                  "cache",
                  "$ / turn",
                  "$ run",
                  "in cited source",
                  "price now",
                ].map((h) => (
                  <th key={h} scope="col" className="py-1.5 pr-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums text-text-soft">
              {rows.map((r) => (
                <tr key={r.model} className="border-b border-line last:border-b-0">
                  {/* The model names the row, so it is a header rather than a
                      cell — that is what lets a screen reader say which model a
                      number belongs to instead of reading twelve bare figures. */}
                  <th scope="row" className="py-1.5 pr-3 font-normal text-text">
                    {r.model}
                  </th>
                  <td className="py-1.5 pr-3">
                    {r.passed}/{r.answered}
                  </td>
                  <td className="py-1.5 pr-3">
                    {r.broke === 0 ? (
                      "0"
                    ) : (
                      <span className="text-accent">
                        {r.broke}/{r.cases}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">{formatSeconds(median(r.ttftMs))}</td>
                  <td className="py-1.5 pr-3">{median(r.tokensPerSecond)?.toFixed(1) ?? "—"}</td>
                  <td className="py-1.5 pr-3">{formatCount(median(r.inputTokens))}</td>
                  <td className="py-1.5 pr-3">{formatCount(median(r.outputTokens))}</td>
                  <td className="py-1.5 pr-3">
                    {r.cacheHitRate == null ? "—" : formatPercent(r.cacheHitRate)}
                  </td>
                  <td className="py-1.5 pr-3">
                    {formatTurnCost(r.costPerTaskUsd)}
                  </td>
                  <td className="py-1.5 pr-3">{formatCost(r.costTotalUsd, 4)}</td>
                  <td className="py-1.5 pr-3">
                    {r.claims === 0 ? "—" : `${r.verified}/${r.claims}`}
                  </td>
                  <td className="py-1.5 pr-3">
                    <PriceFlag model={r.model} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollFade>
        <Note>
          Costs use the list prices on record when each run was published and aren&apos;t
          recomputed when a price changes. &ldquo;price now&rdquo; describes the chat&apos;s
          current prices, checked {PRICES_CHECKED}. A median over fewer than{" "}
          {MIN_TURNS_FOR_P50}{" "}
          measured turns is withheld and shown as an em dash. No 95th percentile is computed,
          because one sample per case can&apos;t support one. &ldquo;in cited source&rdquo; is the
          site&apos;s citation checker run over that model&apos;s answers: the sentences whose
          names and numbers it found in the source they cited, out of the sentences with
          something checkable in them. A match doesn&apos;t mean the sentence is true. For where
          the rest were found, see{" "}
          <Link href="/measurements" className="text-accent">
            the groundedness section
          </Link>
          .
        </Note>
      </Section>

      {/* --- the archive ------------------------------------------------- */}
      <Archive archive={archive} current={current} retired={retired} />

      {/* --- the caveats, as a section rather than a footnote ------------ */}
      <Section heading={COPY.limitsHeading}>
        <dl className="mt-4 space-y-4">
          {LIMITS.map((limit) => (
            <div key={limit.title}>
              <dt className="t-meta font-medium text-text">{limit.title}</dt>
              <dd className="t-body mt-1 max-w-[62ch] text-text-faint">
                {limit.body}
                {"id" in limit && limit.id === "sample" && (
                  <>
                    {" "}
                    {repeats.length === 0
                      ? "Nothing here says by how much."
                      : repeats.map((r, i) => (
                          <span key={r.model}>
                            {i > 0 && " "}
                            {modelName(r.model)} was run{" "}
                            {r.passed.length === 2 ? "twice" : `${r.passed.length} times`} on{" "}
                            {r.date} and passed {r.passed.join(", then ")} of {r.total}
                            {i === repeats.length - 1 &&
                              (repeats.length === 1
                                ? ". That's the only measure of run-to-run variation on this page, and it covers one model."
                                : ". Those are the only measures of run-to-run variation on this page.")}
                            {i < repeats.length - 1 && "."}
                          </span>
                        ))}
                  </>
                )}
                {"id" in limit && limit.id === "cost" && bill && (
                  <>
                    {" "}
                    {bill.off.length === 0
                      ? "For the runs charted here, the Gateway's bill matched every model's list-price total."
                      : `For the runs charted here, the Gateway's bill matched the list-price total for every model except ${bill.off
                          .map(
                            (o) =>
                              `${modelName(o.model)}, which was billed ${formatCost(o.billed, 4)} against ${formatCost(o.list, 4)} at list price`,
                          )
                          .join("; ")}.`}
                  </>
                )}
                {"id" in limit && limit.id === "settings" && (
                  <>
                    {" "}
                    {tuned.length === 0
                      ? "Every model ran at its provider's default reasoning."
                      : `${tuned.map((t) => `${modelName(t.model)} ${reasoningPhrase(t.level)} ${t.turn}`).join("; ")}. Everything else runs at the provider's default.`}
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </DocPage>
  );
}

// --- pieces -----------------------------------------------------------------

/**
 * A run's date, with the UTC time added when the same model has another run
 * that day — two "20 Oct 2026" entries side by side read as a duplicate.
 */
function runLabel(run: PublishedRun, siblings: PublishedRun[]): string {
  const day = formatDate(run.ranAt);
  const shared = siblings.filter((r) => formatDate(r.ranAt) === day).length > 1;
  return shared && run.ranAt ? `${day}, ${run.ranAt.slice(11, 16)} UTC` : day;
}

/** "at low reasoning effort", or "with reasoning off" — never "at none effort". */
function reasoningPhrase(level: ReasoningLevel): string {
  if (level === "none") return "runs with reasoning off";
  if (level === "provider-default") return "runs at the provider's default reasoning";
  return `reasons at ${level} effort`;
}

/**
 * Every run ever published, per model, newest first. "Shown above" marks the
 * runs the charts actually read, which is not always a model's newest: a
 * retired model's runs are never charted, however recent.
 */
function Archive({
  archive,
  current,
  retired,
}: {
  archive: PublishedRun[];
  current: PublishedRun[];
  retired: string[];
}) {
  const charted = new Set(current);
  const isRetired = new Set(retired);
  return (
    <Section heading={COPY.archiveHeading} intro={COPY.archiveIntro}>
      <div className="mt-4 space-y-2">
        {runHistory(archive).map(({ model, runs }) => (
          <div key={model} className="border-b border-line pb-2 last:border-b-0">
            <div className="t-meta flex flex-wrap items-baseline gap-x-3">
              <span className="text-text">{model}</span>
              {model === DEFAULT_MODEL && <span className="text-accent">default</span>}
              {isRetired.has(model) && <span className="text-text-faint">retired</span>}
            </div>
            <div className="t-meta mt-1 flex flex-wrap gap-x-4 gap-y-1 text-text-faint">
              {runs.map((run, i) => (
                <span key={`${run.ranAt}-${i}`}>
                  {runLabel(run, runs)}{" "}
                  <span className="tabular-nums text-text-soft">
                    {run.passed}/{run.total}
                  </span>
                  {charted.has(run) && <span className="ml-1 text-accent">shown above</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Header() {
  return (
    <>
      <h1 className="t-title font-medium text-text">
        Five models, one corpus
      </h1>
      <p className="t-meta mt-3 text-text-faint">
        A companion to{" "}
        <Link href="/measurements" className="text-accent">
          what this assistant scores
        </Link>
        .
      </p>
    </>
  );
}

/**
 * Names the confidence in a model's CURRENT prices, from lib/pricing.ts.
 *
 * Every model the chat offers has a price, so a measured model with no entry is
 * one the chat has dropped. It used to read "no price on record" — beside a
 * dollar figure that was, in fact, priced, at the rates of the day it ran.
 */
function PriceFlag({ model }: { model: string }) {
  const confidence = PRICE_CONFIDENCE[model];
  if (confidence === "confirmed") return <span className="text-text-faint">confirmed</span>;
  if (confidence === "derived") return <span className="text-text-faint">cache rate derived</span>;
  if (confidence === "unconfirmed") return <span className="text-accent">unconfirmed</span>;
  return <span className="text-text-faint">no longer offered</span>;
}

/**
 * Ids as a sentence's list, each on one line. A browser breaks at a hyphen, and
 * "claude-haiku-" at the end of one line with "4.5" at the start of the next
 * reads as two things.
 */
function ModelList({ ids }: { ids: string[] }) {
  return ids.map((id, i) => (
    <span key={id}>
      {i > 0 && ", "}
      <span className="whitespace-nowrap text-text">{id}</span>
    </span>
  ));
}

function Section({
  heading,
  intro,
  children,
}: {
  heading: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="t-head font-medium text-text">{heading}</h2>
      {intro && (
        <p className="t-body mt-3 max-w-[62ch] text-text-soft">{intro}</p>
      )}
      {children}
    </section>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-[20px] leading-none text-text">{value}</div>
      <div className="t-label mt-1.5 text-text-faint">{label}</div>
      {note && <div className="t-meta text-text-faint">{note}</div>}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="t-meta mt-4 max-w-[62ch] text-text-faint">{children}</p>
  );
}
