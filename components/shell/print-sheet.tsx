"use client";

import { useEffect, useState } from "react";
import { textOf, toolOutputs, type ChatMessage, type RoleFit } from "./use-conversation";
import { stripCitations, citationIds } from "@/lib/verify";
import { DISCLAIMER, SITE_NAME, SITE_URL } from "@/lib/site";
import { Markdown } from "./markdown";
import { FIT_LABELS, fitExcerptNote } from "./shell-data";

// The typeset document (docs/idea-decisions.md #17): what "save as PDF" saves.
// Not the chat window on paper: no application chrome, citation ids printed
// under their paragraph instead of in a hover margin, and the assessment as a
// table. It has to read like a document a recruiter can attach to an email.
//
// Always in the DOM and display:none until print (the print block in
// app/globals.css): nothing can reliably intercept Cmd-P, and rendering on
// demand would open the dialog over a page that hasn't laid out yet.

export function PrintSheet({
  messages,
  permalink,
}: {
  messages: ChatMessage[];
  /** Present only once the reader has generated one. */
  permalink?: string | null;
}) {
  // Set after mount: the server has neither the reader's locale nor their
  // "today", so rendering either during SSR would mismatch on hydration.
  const [printedOn, setPrintedOn] = useState("");
  useEffect(() => {
    const stamp = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    queueMicrotask(() => setPrintedOn(stamp));
  }, []);

  return (
    <div className="print-only doc [font-family:var(--font-geist-sans)]" aria-hidden="true">
      <div className="doc-block pb-4">
        <h1 className="text-[19px] font-medium tracking-[-0.01em]">{SITE_NAME}</h1>
        <p className="mt-1 text-[11px]">
          {[SITE_URL, printedOn].filter(Boolean).join(" · ")}
        </p>
        {permalink && <p className="mt-0.5 break-all text-[10px]">{permalink}</p>}
      </div>

      <div className="doc-rule space-y-5 pt-4">
        {messages.map((m) => {
          const text = textOf(m);
          const outs = toolOutputs(m);
          if (!text && !outs.length) return null;

          if (m.role === "user") {
            return (
              <p key={m.id} className="doc-block whitespace-pre-wrap pt-2 text-[13px] font-medium">
                {text}
              </p>
            );
          }

          const ids = citationIds(text);
          return (
            <div key={m.id} className="doc-block space-y-2">
              <Markdown text={stripCitations(text)} />
              {ids.length > 0 && (
                <p className="text-[10px]">Sources: {ids.join(", ")}</p>
              )}
              {outs
                .filter((o) => o.type === "tool-roleFit")
                .map((o, i) => (
                  <PrintedFit key={i} fit={o.output as RoleFit} />
                ))}
            </div>
          );
        })}
      </div>

      <p className="doc-rule mt-6 pt-3 text-[10px] leading-relaxed">{DISCLAIMER}</p>
    </div>
  );
}

const COUNT_ORDER = ["met", "partial", "unmet", "unclear"] as const;

/** The requirement table, laid out for paper. Same rows, same tags, no colour. */
function PrintedFit({ fit }: { fit: RoleFit }) {
  if (!fit?.rows?.length) return null;
  const counts = COUNT_ORDER.filter((v) => (fit.counts?.[v] ?? 0) > 0)
    .map((v) => `${fit.counts[v]} ${v}`)
    .join(" · ");
  // A short fit link carries an excerpt of the rows; see fitExcerptNote.
  const total = COUNT_ORDER.reduce((sum, v) => sum + (fit.counts?.[v] ?? 0), 0);

  return (
    <div className="doc-rule mt-3 pt-3">
      <p className="text-[12px] font-medium">{fit.role}</p>
      {counts && <p className="mt-0.5 text-[10px]">{counts}</p>}
      {total > fit.rows.length && (
        <p className="mt-0.5 text-[10px]">{fitExcerptNote(fit.rows.length, total)}</p>
      )}

      <table className="mt-2 w-full border-collapse text-left text-[11px]">
        <tbody>
          {fit.rows.map((row, i) => (
            <tr key={i} className="doc-block align-top">
              <td className="w-[64px] border-t border-line py-1.5 pr-2 uppercase tracking-[0.06em]">
                {row.verdict}
              </td>
              <td className="border-t border-line py-1.5">
                <span className="font-medium">{row.requirement}</span>
                {row.evidence && (
                  <span className="block">{stripCitations(row.evidence)}</span>
                )}
                {row.sources.length > 0 && (
                  <span className="block text-[10px]">{row.sources.join(", ")}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {fit.gaps.length > 0 && (
        <div className="doc-block mt-3">
          <p className="text-[11px] font-medium">{FIT_LABELS.gaps}</p>
          <ul className="mt-1 list-disc pl-4 text-[11px]">
            {fit.gaps.map((gap, i) => (
              <li key={i}>{stripCitations(gap)}</li>
            ))}
          </ul>
        </div>
      )}
      {!fit.gaps.length && fit.noGapsRationale && (
        <div className="doc-block mt-3">
          <p className="text-[11px] font-medium">{FIT_LABELS.noGaps}</p>
          <p className="text-[11px]">{stripCitations(fit.noGapsRationale)}</p>
        </div>
      )}
      {fit.verdict && (
        <p className="doc-block mt-3 text-[11px]">{stripCitations(fit.verdict)}</p>
      )}
      {/* Travels with the table on purpose; see FIT_LABELS in shell-data.ts. */}
      <p className="mt-2 text-[10px] leading-relaxed">{FIT_LABELS.notAScore}</p>
    </div>
  );
}
