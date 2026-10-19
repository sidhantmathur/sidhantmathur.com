"use client";

import { useMemo, type ReactNode } from "react";
import { ALL_CHUNKS_BY_ID } from "@/lib/corpus";
import { stripCitations, verifyAnswer, type Claim } from "@/lib/verify";
import { Markdown } from "./markdown";
import type { PanelView } from "./use-conversation";

// One assistant answer, with its sources (roadmap Sprint 3: #12 marginalia,
// #21 verified claims, #4 sources touched).
//
// THE ORDER OF EVENTS IS THE FEATURE. While an answer streams, this renders
// prose and nothing else — the citation markers are stripped as they arrive and
// no source appears. When the turn settles, the margin and the source row
// appear at once. That is #4 as the roadmap resolved it: a settle, not a
// flicker. Nothing was looked up before the answer, so nothing here is allowed
// to animate as though something had been.
//
// The margin only exists at lg. Below that the source row under the answer
// carries the same information in one line, which is also the only surface a
// touch reader gets — and it is the entry point to the panel either way.
//
// Every verdict rendered here comes from lib/verify.ts, which is a string
// comparison against the corpus. The model has no vote in what gets marked.

const MAX_LISTED_DOWNGRADES = 3;

export function Answer({
  text,
  settled,
  onOpenSource,
}: {
  text: string;
  /** False while the turn is still streaming. */
  settled: boolean;
  onOpenSource: (view: PanelView) => void;
}) {
  const check = useMemo(() => verifyAnswer(text, ALL_CHUNKS_BY_ID), [text]);

  // While the answer streams it carries a caret at the writing edge. The site
  // had no marker for "this is still arriving" anywhere in the message column —
  // the only signals were the header dot and the phase line, and the phase line
  // deliberately disappears the moment prose exists (see phaseOf). So for the
  // whole body of a long answer nothing on the page said it wasn't finished.
  //
  // The glyph is the one already used by the idle line, in the accent, so this
  // reads as the same cursor rather than a new piece of vocabulary. It is a
  // character rather than an animated element on purpose: one motion at a time,
  // and during streaming that motion is the text itself.
  if (!settled) {
    return (
      <Markdown
        text={stripCitations(text)}
        trailing={
          <span aria-hidden className="ml-0.5 text-accent">
            ▍
          </span>
        }
      />
    );
  }

  // An answer that cited NOTHING gets one line saying so, rather than a mark
  // beside every sentence. The per-claim detail earns its space by contrast —
  // "these three are sourced and that one isn't" is a reading of the answer;
  // "none of this is sourced" said six times is just noise, and noise is how a
  // check stops being read. (The job-description flow is where this shows up:
  // the model writes its summary off the assessment it just produced and cites
  // none of it. Sprint 4's `requirementTable` is where that gets fixed at the
  // schema, per the roadmap.)
  const nothingCited = !check.citedIds.length && !check.unknownIds.length;

  const gutter = (index: number): ReactNode => {
    const block = check.blocks[index];
    if (!block || nothingCited) return null;
    const downgraded = check.claims.filter(
      (c) => c.blockIndex === index && c.verdict !== "verified",
    );
    if (!block.ids.length && !downgraded.length) return null;

    return (
      <div className="space-y-1 pt-1 text-[12px] leading-[1.5]">
        {block.ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onOpenSource({ kind: "source", id })}
            title={sourceTitle(id)}
            className="block w-full truncate py-1 text-left text-text-faint transition-colors hover:text-accent"
          >
            {shortLabel(id)}
          </button>
        ))}
        {downgraded.map((claim, i) => (
          <span
            key={i}
            title={claimDetail(claim)}
            className={`block truncate ${claim.verdict === "unverified" ? "text-accent" : "text-text-faint"}`}
          >
            {MARGIN_LABEL[claim.verdict]}
          </span>
        ))}
      </div>
    );
  };

  return (
    <>
      <Markdown text={check.text} gutter={gutter} />
      <SourceRow check={check} onOpenSource={onOpenSource} />
    </>
  );
}

/**
 * The sources an answer touched, under the answer, everywhere. Post-hoc by
 * construction — it renders `citedIds`, which only exist because the model
 * wrote them into a finished answer.
 */
function SourceRow({
  check,
  onOpenSource,
}: {
  check: ReturnType<typeof verifyAnswer>;
  onOpenSource: (view: PanelView) => void;
}) {
  const nothingCited = !check.citedIds.length && !check.unknownIds.length;
  // Listed one by one: the two verdicts a reader should actually weigh. A
  // mis-citation is not listed per sentence — its facts are in the record, so
  // the only news is that the pointer is off, and that is one quiet line with
  // the token detail one click away in the trace.
  const listable = nothingCited
    ? []
    : check.downgraded.filter((c) => c.verdict !== "miscited");
  const shown = listable.slice(0, MAX_LISTED_DOWNGRADES);
  const rest = listable.length - shown.length;
  const miscited = nothingCited
    ? 0
    : check.downgraded.filter((c) => c.verdict === "miscited").length;

  if (!check.citedIds.length && !check.claims.length) return null;

  return (
    <div className="space-y-1.5 pt-1">
      {check.citedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {check.citedIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onOpenSource({ kind: "source", id })}
              title={sourceTitle(id)}
              // Below lg the margin doesn't exist, so this row is the only way
              // to open a source — and it is opened with a thumb. py-2 makes
              // the chip a real target rather than a 26px band of text.
              className="border border-line px-3 py-2.5 text-[13px] text-text-faint transition-colors hover:border-accent hover:text-accent"
            >
              ↗ {chipLabel(id)}
            </button>
          ))}
        </div>
      )}

      {/* The downgrades. Quiet, specific, and never more than a few lines —
          the detail is what makes this a check rather than a badge. */}
      {/* Three verdicts, two weights. Since wave 2 the accent is reserved for
          a number or name the record has nowhere (or a source that doesn't
          exist). "It attached no source" and "the fact is real but cited to
          the wrong chunk" are said in the faint register — the second used to
          be painted the same colour as a fabrication, which made the site look
          like it doubted its own owner's headline numbers. */}
      {shown.map((claim, i) => (
        <p key={i} className="t-meta text-text-faint">
          <span className={claim.verdict === "unverified" ? "text-accent" : "text-text-soft"}>
            {ROW_LABEL[claim.verdict]}
          </span>{" "}
          · {rowDetail(claim)}
        </p>
      ))}
      {rest > 0 && (
        <p className="t-meta text-text-faint">and {rest} more like it.</p>
      )}
      {miscited > 0 && (
        <p className="t-meta text-text-faint">
          <span className="text-text-soft">{ROW_LABEL.miscited}</span> ·{" "}
          {miscited === 1 ? "one sentence names" : `${miscited} sentences name`} facts the
          record holds under a different source.{" "}
          <button
            type="button"
            onClick={() => onOpenSource({ kind: "instruments" })}
            className="-my-2 py-2 text-text-soft underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent"
          >
            See the trace
          </button>
        </p>
      )}

      {nothingCited && check.claims.length > 0 && (
        <p className="t-meta text-text-faint">
          <span className="text-text-soft">no sources cited</span> · this answer doesn&apos;t
          point at a specific part of the record.
        </p>
      )}
    </div>
  );
}

/** `resume:nokia` → `Resume — Nokia, Toronto ON`, for a chip or a tooltip. */
function sourceTitle(id: string): string {
  const chunk = ALL_CHUNKS_BY_ID[id];
  if (!chunk) return id;
  return `${chunk.sourceLabel} — ${chunk.heading}`;
}

/**
 * The same, short enough to sit on one line. Resume headings carry a location
 * and a URL after an em dash — useful in the panel, noise on a chip, and long
 * enough to push every chip onto a row of its own.
 */
function chipLabel(id: string): string {
  const chunk = ALL_CHUNKS_BY_ID[id];
  if (!chunk) return id;
  const heading = chunk.heading.split("—")[0]!.replace(/\(.*?\)/g, "").trim();
  return heading && heading !== chunk.sourceLabel
    ? `${chunk.sourceLabel} — ${heading}`
    : chunk.sourceLabel;
}

/** The margin is 6.5rem wide, so it gets the slug and nothing else. */
function shortLabel(id: string): string {
  return id.split(":")[1] ?? id;
}

/**
 * The margin is 6.5rem — fourteen characters of 12px mono — so each verdict
 * gets a label that fits it whole rather than one that truncates mid-word.
 */
const MARGIN_LABEL: Record<Claim["verdict"], string> = {
  verified: "verified",
  uncited: "uncited",
  miscited: "not in source",
  unverified: "not in record",
};

/** The same verdicts under the answer, where there is room for the full phrase. */
const ROW_LABEL: Record<Claim["verdict"], string> = {
  verified: "verified",
  uncited: "uncited",
  miscited: "not in cited source",
  unverified: "not in the record",
};

/**
 * Why a claim was downgraded, in a sentence — the hover text on the margin
 * mark. Says what was checked and what wasn't found, rather than asserting the
 * sentence is wrong: the check knows the difference and the copy has to as
 * well. The full per-token version lives in the instruments' citation trace.
 */
function claimDetail(claim: Claim): string {
  if (claim.verdict === "uncited") {
    return `no source cited for "${clip(claim.text)}"`;
  }
  if (claim.unknownIds.length) {
    return `cited ${claim.unknownIds.join(", ")}, which isn't a source on this site`;
  }
  if (claim.verdict === "miscited") {
    return `${claim.missing.join(", ")} — not in ${claim.ids.join(", ")}, but in ${claim.elsewhere.join(", ")}`;
  }
  return `${claim.absent.join(", ")} — not in any source on this site`;
}

/** The line under the answer for the two verdicts that are listed one by one. */
function rowDetail(claim: Claim): string {
  if (claim.verdict === "uncited") {
    return `no source cited for "${clip(claim.text)}"`;
  }
  if (claim.unknownIds.length) {
    return `cited ${claim.unknownIds.join(", ")}, which isn't a source on this site`;
  }
  return `${claim.absent.join(", ")}, in "${clip(claim.text, 60)}"`;
}

function clip(text: string, max = 70): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
