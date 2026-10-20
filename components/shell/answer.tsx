"use client";

import { useMemo, type ReactNode } from "react";
import { ALL_CHUNKS_BY_ID } from "@/lib/corpus";
import { stripCitations, verifyAnswer, type Claim } from "@/lib/verify";
import { Markdown } from "./markdown";
import type { PanelView } from "./use-conversation";

// One assistant answer with its sources: citation marginalia, verified claims
// and the row of sources it touched.
//
// THE ORDER OF EVENTS is the feature. While an answer streams, this renders
// prose and nothing else: citation markers are stripped as they arrive and no
// source appears. When the turn settles, the margin and the source row appear
// at once. Nothing was looked up before the answer, so nothing here may
// animate as though something had been.
//
// The margin only exists at lg. Below that, the source row under the answer
// carries the same information and is a touch reader's way into the panel.
//
// Every verdict comes from lib/verify.ts, a string comparison against the
// corpus. The model has no say in what gets marked.

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

  // While streaming, a caret marks the writing edge. Without it nothing in the
  // message column says a long answer is unfinished: the phase line disappears
  // as soon as prose exists (see phaseOf). It is the idle line's glyph in the
  // accent, so it reads as the same cursor, and a static character rather than
  // an animation because the arriving text is already the motion.
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

  // An answer that cited nothing gets one line saying so rather than a mark
  // beside every sentence. Per-claim marks earn their space by contrast ("these
  // three are sourced and that one isn't"); "none of this is sourced" said six
  // times is noise, and noise is how a check stops being read.
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
              // Below lg this row is the only way to open a source, usually with
              // a thumb, so the vertical padding makes the chip a real target.
              className="border border-line px-3 py-2.5 text-[13px] text-text-faint transition-colors hover:border-accent hover:text-accent"
            >
              ↗ {chipLabel(id)}
            </button>
          ))}
        </div>
      )}

      {/* The downgrades: quiet, specific, never more than a few lines. Only a
          number or name the record has nowhere (or a source that doesn't
          exist) gets the accent. "No source attached" and "real fact, wrong
          chunk" stay in the faint register, so a mis-citation never looks like
          a fabrication. */}
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
  if (claim.unknownIds.length) return unknownSources(claim.unknownIds);
  if (claim.verdict === "miscited") {
    return `${claim.missing.join(", ")} ${isAre(claim.missing)} in ${claim.elsewhere.join(", ")}, not ${claim.ids.join(", ")}`;
  }
  return `${claim.absent.join(", ")} ${isAre(claim.absent)}n't in any source on this site`;
}

function isAre(tokens: string[]): string {
  return tokens.length === 1 ? "is" : "are";
}

function unknownSources(ids: string[]): string {
  return ids.length === 1
    ? `cited ${ids[0]}, which isn't a source on this site`
    : `cited ${ids.join(", ")}, which aren't sources on this site`;
}

/** The line under the answer for the two verdicts that are listed one by one. */
function rowDetail(claim: Claim): string {
  if (claim.verdict === "uncited") {
    return `no source cited for "${clip(claim.text)}"`;
  }
  if (claim.unknownIds.length) return unknownSources(claim.unknownIds);
  return `${claim.absent.join(", ")}, in "${clip(claim.text, 60)}"`;
}

function clip(text: string, max = 70): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
