"use client";

import { CHUNKS } from "@/lib/chunks.generated";
import type { PanelView } from "./use-conversation";
import { ActionLink } from "./action-link";

// Manual mode: what a visitor sees once the hourly budget is spent
// (docs/idea-decisions.md #15).
//
// It is the corpus by hand, not a cached model or canned answers in Sidhant's
// voice; writing what he would have said is the invention the copy rule
// forbids. Each answer is a knowledge-base chunk rendered verbatim with the id
// the model would have cited. No model runs and no token is spent. FAQ chunks
// still carrying an unresolved to-do marker are held back.

// The headline is the shell's rate-limit line, passed in, which already points
// the reader at the resume; this component follows through on it.
const MANUAL_COPY = {
  body:
    "Nothing is broken and nothing is lost — the limit is per IP and refills on a sliding hour, so the assistant comes back on its own. In the meantime, here is the same material it was reading, by hand: these are the source files the answers are built from, quoted rather than summarized.",
  faqHeading: "Straight answers, unassisted",
  corpusHeading: "The rest of the record",
  footer:
    "No model was called to render this, and it cost nothing. The resume is the authoritative version either way.",
};

export function ManualMode({
  headline,
  onOpenSource,
}: {
  headline: string;
  onOpenSource: (view: PanelView) => void;
}) {
  const faq = CHUNKS.filter((c) => c.source === "faq" && !c.text.includes("[TODO"));

  return (
    <div className="space-y-4 border-l-2 border-line bg-raised px-3 py-3">
      <div className="space-y-2">
        <p className="t-body text-text">{headline}</p>
        <p className="t-meta text-text-soft">{MANUAL_COPY.body}</p>
      </div>

      <div>
        <div className="t-label text-text-faint">{MANUAL_COPY.faqHeading}</div>
        <dl className="mt-2 space-y-3">
          {faq.map((chunk) => (
            <div key={chunk.id}>
              <dt className="t-meta text-text">{chunk.heading}</dt>
              {chunk.lines.map((line, i) => (
                <dd key={i} className="t-meta text-text-soft">
                  {line}
                </dd>
              ))}
              {/* The id it would have cited, so the manual answer and the
                  assisted one are visibly the same piece of the record. */}
              <dd className="mt-0.5 t-label text-text-faint">{chunk.id}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <div className="t-label text-text-faint">{MANUAL_COPY.corpusHeading}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <ActionLink onClick={() => onOpenSource({ kind: "corpus" })}>
            Every source, listed
          </ActionLink>
          <ActionLink href="/resume">Full resume</ActionLink>
          <ActionLink href="/resume.pdf" external>
            Resume PDF
          </ActionLink>
          <ActionLink href="/projects/adarle20">A Darle 20</ActionLink>
          <ActionLink href="/projects/nokia">Nokia</ActionLink>
          <ActionLink href="/projects/dell-ml">Dell</ActionLink>
          <ActionLink href="mailto:hello@sidhantmathur.com" external>
            Email
          </ActionLink>
        </div>
      </div>

      <p className="t-meta text-text-faint">{MANUAL_COPY.footer}</p>
    </div>
  );
}
