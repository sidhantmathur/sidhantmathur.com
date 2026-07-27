import type { Metadata } from "next";
import Link from "next/link";

import { FrontierScatter } from "@/components/charts/frontier-scatter";
import { RankedBars } from "@/components/charts/ranked-bars";
import { ScorecardHeatmap } from "@/components/charts/scorecard-heatmap";
import { DocPage } from "@/components/layout/doc-page";
import { BUILT_AT, PUBLISHED_EVALS } from "@/lib/measurements.generated";
import { MIN_TURNS_FOR_P50, formatDate, formatPercent } from "@/lib/measurements";
import {
  allGroups,
  formatCost,
  formatCount,
  formatSeconds,
  frontier,
  latestRunPerModel,
  rank,
  runHistory,
  supportsMedian,
  toRow,
  type ModelRow,
} from "@/lib/model-comparison";
import { PRICES_CHECKED, PRICE_CONFIDENCE } from "@/lib/pricing";

// /measurements/models — the model bake-off (roadmap Sprint 8).
//
// Every allowlisted model, run against the same 22-case corpus, on the same
// afternoon, against the same server. What that produces is the artifact the
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

export const metadata: Metadata = {
  alternates: { canonical: "/measurements/models" },
  title: "Five models, one corpus",
  description:
    "Every model this site can run, measured against the same eval corpus: pass rate, time to first token, output speed, tokens and cost per task.",
};

const COPY = {
  intro:
    "This site can run five models behind one chat endpoint. This page is what happened when all five answered the same 22 questions, in the same order, against the same server, on the same afternoon — graded by the same checker, and costed at list price.",
  why: "The point is not to crown a winner. It is that a model choice is a trade between four things that pull against each other — how often the answer is right, how long you wait for it, how much of it you get, and what it costs — and that trade is only legible once someone measures all four on the same corpus.",
  empty:
    "No live run has been published, so there is nothing to compare. The bake-off exists and runs locally; publishing it is a deliberate step, and this page stays empty until someone takes it.",

  frontierHeading: "Quality against cost",
  frontierNote:
    "Median list-price cost of one graded turn, against the share of ANSWERED cases that passed. Better is up; cheaper is left. A turn that broke mid-stream is not counted as a wrong answer — reliability is its own panel below.",
  latencyHeading: "Quality against latency",
  latencyNote:
    "Median time to the model's first token, against the share of ANSWERED cases that passed. Better is up; faster is left.",

  panelsHeading: "The numbers underneath",
  panelsIntro:
    "One panel per measurement, each sorted best-first. Nothing here is stacked or double-encoded: every panel plots one number, and where there is a winner it is the only bar wearing the accent. One panel has no winner, and nothing in it is highlighted — a longer answer is not a better answer, it is just more of the bill.",

  scorecardHeading: "The scorecard",
  scorecardIntro:
    "Pass rate by model and by what the group is testing. There is deliberately no single intelligence score: a model that answers grounded questions well and folds under prompt injection is a different problem from one that is mediocre at both, and one number cannot tell you which you have.",
  groupsNote:
    "grounded — does it state facts that are actually in the corpus, and say 'I don't have that' when they aren't. refusal — does it decline out-of-scope requests instead of helping. injection — role override, prompt extraction, knowledge-base dump, a fake system message, disparagement bait, persona hijack. roleFit — pasted job descriptions, graded on whether the assessment names the gaps rather than flattering the reader.",

  tableHeading: "Everything, as a table",
  tableIntro:
    "The same figures the charts plot, plus the ones no chart shows. This is the accessibility twin for every chart above — nothing on this page is reachable only by colour or only by hover.",

  archiveHeading: "The run archive",
  archiveIntro:
    "Every run ever published, per model, with the date it was measured. Until this sprint a second run on a model overwrote the first, which meant a regression was invisible and a figure measured twice looked exactly like one measured once. Runs are now kept; the charts above read the most recent per model.",

  limitsHeading: "What this does not measure",
} as const;

const LIMITS = [
  {
    title: "One sample per case",
    body: "Each model answered each question once. Every timing figure here is a median over about twenty turns, which is enough to rank models and nowhere near enough for a 95th percentile — so none is computed. Re-running the same corpus on the same model would move these numbers, and nothing here says by how much.",
  },
  {
    title: "Latency includes the day it was measured",
    body: "Time to first token is the server's own measurement, with the browser network excluded — but not the hop from a home connection to the provider, nor whatever load that provider was under that afternoon. It is a real measurement of a real request; it is not a claim about the model in a datacentre.",
  },
  {
    title: "The grader is a string matcher, not a judge",
    body: "Cases pass by containing specific evidence — a name, a number, a refusal. That keeps runs free and reproducible, and it means a wrong answer containing the right number still passes, and a right answer phrased unusually can still fail. This is a regression net, not a quality score, and a pass rate here is not an accuracy claim.",
  },
  {
    title: "Costs are list prices, not an invoice",
    body: "Every dollar figure is computed from published per-token rates on the date below and the tokens the run actually used. It is an estimate at list price. Prompt-cache rates are mostly derived from a published discount rather than separately published, and one model's prices could not be confirmed at all — it is marked in the table.",
  },
  {
    title: "A broken turn is counted, but it is not counted as a wrong answer",
    body: "Some turns died mid-stream and never produced an answer. Those are excluded from the pass rate — scoring a dropped connection as bad judgment is the confusion this whole site is built to avoid — and reported on their own panel instead. But one afternoon of requests is a thin basis for a reliability claim: it says a model dropped streams here, then, not that it drops one in four everywhere.",
  },
  {
    title: "Token counts are each provider's own",
    body: "Every model got byte-identical prompts, so the spread in input tokens is mostly the tokenizers disagreeing about how to count the same text, not one model being sent more work. Seconds and dollars compare across rows; tokens really do not.",
  },
  {
    title: "The corpus is narrow on purpose",
    body: "Twenty-two cases about one person's résumé and the ways someone might try to break a chatbot answering questions about it. That is exactly the workload this site runs, which is why the numbers are useful here — and why they do not transfer to yours.",
  },
] as const;

export default function ModelComparisonPage() {
  const snapshot = PUBLISHED_EVALS;
  const archive = snapshot?.live.runs ?? [];
  const rows = latestRunPerModel(archive).map(toRow);
  const groups = allGroups(rows);
  const history = runHistory(archive);

  if (!rows.length) {
    return (
      <DocPage>
        <Header />
        <p className="mt-8 max-w-[62ch] border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-text-faint">
          {COPY.empty}
        </p>
      </DocPage>
    );
  }

  const turnsGraded = rows.reduce((n, r) => n + r.cases, 0);
  const turnsBroke = rows.reduce((n, r) => n + r.broke, 0);
  const casesEach = rows[0]?.cases ?? 0;
  const uniformCorpus = rows.every((r) => r.cases === casesEach);
  const totalCost = rows.reduce<number | null>(
    (n, r) => (n == null || r.costTotalUsd == null ? null : n + r.costTotalUsd),
    0,
  );
  const measuredOn = rows
    .map((r) => r.ranAt)
    .filter((d): d is string => !!d)
    .sort();

  const cost = frontier(rows, (r) => r.costPerTaskUsd, (r) => r.passRate);
  const latency = frontier(
    rows,
    (r) => (supportsMedian(r.ttftMs) ? r.ttftMs!.p50 : null),
    (r) => r.passRate,
  );

  const p50 = (s: ModelRow["ttftMs"]) => (supportsMedian(s) ? s!.p50 : null);

  return (
    <DocPage>
      <Header />

      <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-text-soft md:text-base">
        {COPY.intro}
      </p>
      <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-text-soft">{COPY.why}</p>
      <p className="mt-4 max-w-[62ch] text-[13px] leading-relaxed text-text-faint">
        Measured {measuredOn.length ? formatDate(measuredOn[0]) : "on an unknown date"}
        {measuredOn.length > 1 && formatDate(measuredOn[0]) !== formatDate(measuredOn.at(-1))
          ? ` to ${formatDate(measuredOn.at(-1))}`
          : ""}
        . Published {formatDate(snapshot?.publishedAt)}, built into this page{" "}
        {formatDate(BUILT_AT)}. It is a dated artifact, not a live dashboard — it was run once
        and it goes stale.
      </p>

      {/* --- the sample everything below rests on ----------------------- */}
      <div className="mt-8 border-t border-line pt-6">
        <div className="text-[11px] text-text-faint">turns graded</div>
        <div className="text-[44px] leading-none text-text">{turnsGraded}</div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-4">
          <Figure label="models" value={String(rows.length)} />
          <Figure
            label="cases each"
            value={uniformCorpus ? String(casesEach) : "varies"}
            note={uniformCorpus ? "the same corpus" : "runs cover different case counts"}
          />
          <Figure label="eval groups" value={String(groups.length)} />
          <Figure
            label="broke mid-stream"
            value={String(turnsBroke)}
            note="never produced an answer"
          />
          <Figure
            label="cost of the whole comparison"
            value={formatCost(totalCost, 2)}
            note="list price, every turn"
          />
        </div>
      </div>

      {/* --- the two frontiers ------------------------------------------ */}
      <Section heading={COPY.frontierHeading}>
        <FrontierScatter
          heading="Pass rate against median cost per turn"
          note={COPY.frontierNote}
          points={cost.points}
          unplotted={cost.unplotted}
          xLabel="median cost per turn (log)"
          yLabel="pass rate (answered)"
          xScale="log"
          formatX={(v) => formatCost(v, v < 0.001 ? 5 : 4)}
          formatY={(v) => formatPercent(v)}
          formatYTick={(v) => `${Math.round(v * 100)}%`}
        />
      </Section>

      <Section heading={COPY.latencyHeading}>
        <FrontierScatter
          heading="Pass rate against median time to first token"
          note={COPY.latencyNote}
          points={latency.points}
          unplotted={latency.unplotted}
          xLabel="median time to first token"
          yLabel="pass rate (answered)"
          xScale="linear"
          formatX={(v) => formatSeconds(v)}
          formatY={(v) => formatPercent(v)}
          formatYTick={(v) => `${Math.round(v * 100)}%`}
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
            {...rank(rows, (r) => p50(r.ttftMs), "lower")}
          />
          <RankedBars
            heading="Output speed"
            note="Median output tokens per second across the turn. Higher is better."
            bestLabel="fastest"
            format={(v) => `${v.toFixed(1)} tok/s`}
            {...rank(rows, (r) => (supportsMedian(r.tokensPerSecond) ? r.tokensPerSecond!.p50 : null), "higher")}
          />
          <RankedBars
            heading="Cost per turn"
            note="Median, at list price on the date checked. Lower is better."
            bestLabel="cheapest"
            format={(v) => formatCost(v, v < 0.001 ? 5 : 4)}
            {...rank(rows, (r) => r.costPerTaskUsd, "lower")}
          />
          <RankedBars
            heading="Output tokens per turn"
            note="Median. Neither direction is better — it is how much answer you get, and what the output side of the bill is. Counted by each provider\u2019s own tokenizer, so compare within a row rather than across them."
            format={(v) => formatCount(v)}
            {...rank(rows, (r) => (r.outputTokens ? r.outputTokens.p50 : null), "none")}
          />
          <RankedBars
            heading="Input tokens per turn"
            note="Median. The corpus is identical for every model, so most of the spread here is TOKENIZERS DIFFERING, not one model being sent more — these counts are not comparable across providers the way seconds and dollars are."
            bestLabel="fewest"
            format={(v) => formatCount(v)}
            {...rank(rows, (r) => (r.inputTokens ? r.inputTokens.p50 : null), "lower")}
          />
          <RankedBars
            heading="Turns that broke"
            note="Share of attempted turns that failed in transport or died mid-stream, so the model never produced an answer. Lower is better, and it is deliberately kept out of the pass rate above."
            bestLabel="most reliable"
            format={(v) => formatPercent(v)}
            {...rank(rows, (r) => r.breakRate, "lower")}
          />
          <RankedBars
            heading="Prompt cache hit rate"
            note="Share of input TOKENS served from the provider's cache — not share of turns. Higher is cheaper."
            bestLabel="best"
            format={(v) => formatPercent(v)}
            {...rank(rows, (r) => r.cacheHitRate, "higher")}
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[11px]">
            <thead className="text-text-faint">
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
                  "claims verified",
                  "price",
                ].map((h) => (
                  <th key={h} className="py-1.5 pr-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums text-text-soft">
              {rows.map((r) => (
                <tr key={r.model} className="border-b border-line last:border-b-0">
                  <td className="py-1.5 pr-3 text-text">{r.model}</td>
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
                  <td className="py-1.5 pr-3">{formatSeconds(p50(r.ttftMs))}</td>
                  <td className="py-1.5 pr-3">
                    {r.tokensPerSecond ? r.tokensPerSecond.p50.toFixed(1) : "—"}
                  </td>
                  <td className="py-1.5 pr-3">{formatCount(r.inputTokens?.p50 ?? null)}</td>
                  <td className="py-1.5 pr-3">{formatCount(r.outputTokens?.p50 ?? null)}</td>
                  <td className="py-1.5 pr-3">
                    {r.cacheHitRate == null ? "—" : formatPercent(r.cacheHitRate)}
                  </td>
                  <td className="py-1.5 pr-3">
                    {formatCost(r.costPerTaskUsd, (r.costPerTaskUsd ?? 1) < 0.001 ? 5 : 4)}
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
        </div>
        <Note>
          Prices checked {PRICES_CHECKED}. A median is withheld and shown as an em dash under{" "}
          {MIN_TURNS_FOR_P50}{" "}
          measured turns, and a 95th percentile is not computed at all — one
          sample per case cannot support one. &ldquo;claims verified&rdquo; is the site&apos;s own
          citation checker run over that model&apos;s answers; it counts only sentences with
          something checkable in them.
        </Note>
      </Section>

      {/* --- the archive ------------------------------------------------- */}
      <Section heading={COPY.archiveHeading} intro={COPY.archiveIntro}>
        <div className="mt-4 space-y-2">
          {history.map(({ model, runs }) => (
            <div key={model} className="border-b border-line pb-2 last:border-b-0">
              <div className="text-[12px] text-text">{model}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-faint">
                {runs.map((run, i) => (
                  <span key={`${run.ranAt}-${i}`}>
                    {formatDate(run.ranAt)}{" "}
                    <span className="tabular-nums text-text-soft">
                      {run.passed}/{run.total}
                    </span>
                    {i === 0 && <span className="ml-1 text-accent">shown above</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* --- the caveats, as a section rather than a footnote ------------ */}
      <Section heading={COPY.limitsHeading}>
        <dl className="mt-4 space-y-4">
          {LIMITS.map((limit) => (
            <div key={limit.title}>
              <dt className="text-[12px] text-text">{limit.title}</dt>
              <dd className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-text-faint">
                {limit.body}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </DocPage>
  );
}

// --- pieces -----------------------------------------------------------------

function Header() {
  return (
    <>
      <h1 className="text-[24px] font-medium tracking-[-0.02em] text-text">
        Five models, one corpus
      </h1>
      <p className="mt-3 text-[12px] text-text-faint">
        A companion to{" "}
        <Link href="/measurements" className="text-accent">
          what this assistant scores
        </Link>
        .
      </p>
    </>
  );
}

/** Names the confidence in a model's published prices, from lib/pricing.ts. */
function PriceFlag({ model }: { model: string }) {
  const confidence = PRICE_CONFIDENCE[model];
  if (confidence === "confirmed") return <span className="text-text-faint">confirmed</span>;
  if (confidence === "derived") return <span className="text-text-faint">cache rate derived</span>;
  if (confidence === "unconfirmed") return <span className="text-accent">unconfirmed</span>;
  return <span className="text-text-faint">no price on record</span>;
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
      <h2 className="text-[17px] font-medium tracking-[-0.01em] text-text">{heading}</h2>
      {intro && (
        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-text-soft">{intro}</p>
      )}
      {children}
    </section>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <div className="text-[20px] leading-none text-text">{value}</div>
      <div className="mt-1.5 text-[11px] text-text-faint">{label}</div>
      {note && <div className="text-[11px] text-text-faint">{note}</div>}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-[62ch] text-[12px] leading-relaxed text-text-faint">{children}</p>
  );
}
