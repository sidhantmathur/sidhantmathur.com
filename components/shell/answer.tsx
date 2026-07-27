"use client";

import { useMemo, type ReactNode } from "react";
import { CHUNK_BY_ID } from "@/lib/chunks.generated";
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
  const check = useMemo(() => verifyAnswer(text, CHUNK_BY_ID), [text]);

  if (!settled) {
    return <Markdown text={stripCitations(text)} />;
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
      <div className="space-y-1 pt-1 text-[10px] leading-[1.5]">
        {block.ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onOpenSource({ kind: "source", id })}
            title={sourceTitle(id)}
            className="block w-full truncate text-left text-text-faint transition-colors hover:text-accent"
          >
            {shortLabel(id)}
          </button>
        ))}
        {downgraded.map((claim, i) => (
          <span
            key={i}
            title={claimDetail(claim)}
            className={`block truncate ${
              claim.verdict === "uncited" ? "text-text-faint" : "text-accent"
            }`}
          >
            {claim.verdict === "uncited" ? "uncited" : "unverified"}
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
  const shown = nothingCited ? [] : check.downgraded.slice(0, MAX_LISTED_DOWNGRADES);
  const rest = nothingCited ? 0 : check.downgraded.length - shown.length;

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
              className="border border-line px-2 py-1 text-[11px] text-text-faint transition-colors hover:border-accent hover:text-accent"
            >
              ↗ {chipLabel(id)}
            </button>
          ))}
        </div>
      )}

      {/* The downgrades. Quiet, specific, and never more than a few lines —
          the detail is what makes this a check rather than a badge. */}
      {/* Two verdicts, two weights. "The chunk it cited doesn't say that" is a
          different order of problem from "it attached no source", and rendering
          them at the same volume would flatten the distinction the check exists
          to draw. */}
      {shown.map((claim, i) => (
        <p key={i} className="text-[11px] leading-relaxed text-text-faint">
          <span className={claim.verdict === "uncited" ? "text-text-soft" : "text-accent"}>
            {claim.verdict === "uncited" ? "uncited" : "unverified"}
          </span>{" "}
          · {claimDetail(claim)}
        </p>
      ))}
      {rest > 0 && (
        <p className="text-[11px] text-text-faint">and {rest} more like it.</p>
      )}

      {nothingCited && check.claims.length > 0 && (
        <p className="text-[11px] leading-relaxed text-text-faint">
          <span className="text-text-soft">no sources cited</span> · this answer doesn&apos;t
          point at a specific part of the record.
        </p>
      )}
    </div>
  );
}

/** `resume:nokia` → `Resume — Nokia, Toronto ON`, for a chip or a tooltip. */
function sourceTitle(id: string): string {
  const chunk = CHUNK_BY_ID[id];
  if (!chunk) return id;
  return `${chunk.sourceLabel} — ${chunk.heading}`;
}

/**
 * The same, short enough to sit on one line. Resume headings carry a location
 * and a URL after an em dash — useful in the panel, noise on a chip, and long
 * enough to push every chip onto a row of its own.
 */
function chipLabel(id: string): string {
  const chunk = CHUNK_BY_ID[id];
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
 * Why a claim was downgraded, in a sentence. Says what was checked and what
 * wasn't found, rather than asserting the sentence is wrong — the check knows
 * the difference and the copy has to as well.
 */
function claimDetail(claim: Claim): string {
  if (claim.verdict === "uncited") {
    return `no source cited for "${clip(claim.text)}"`;
  }
  if (claim.unknownIds.length) {
    return `cited ${claim.unknownIds.join(", ")}, which isn't a source on this site`;
  }
  return `${claim.missing.join(", ")} — not in ${claim.ids.join(", ")}`;
}

function clip(text: string, max = 70): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
