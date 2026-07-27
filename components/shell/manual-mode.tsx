"use client";

import Link from "next/link";
import { CHUNKS } from "@/lib/chunks.generated";
import type { PanelView } from "./use-conversation";

// Manual mode (roadmap Sprint 7, #15 — "meet the cached me on rate limit").
//
// A visitor who spends the hourly budget used to get one grey sentence and a
// dead input box. That is the only state on this site where the thing the site
// is FOR stops working, and it was the least considered screen in the build.
//
// WHAT THIS IS NOT: a cached model, a canned personality, or a set of answers
// written in Sidhant's voice for a moment when he can't be asked. Writing "what
// he would have said" is exactly the invention the copy rule exists to prevent,
// and a fake assistant is a worse experience than an honest absence.
//
// WHAT IT IS: the corpus, by hand. Every answer below is a chunk of the same
// knowledge base the model was reading a minute ago, rendered verbatim, with
// the ids it would have cited. No model runs, no token is spent, and the
// material is identical — what is missing is the part that picks which piece
// answers your question, which is the part you now do yourself.
//
// Chunks carrying an unresolved [TODO are held back: the knowledge base is
// allowed to have holes in it, and a hole is not an answer.

// `headline` is not here: it is the rate-limit line from docs/site-copy.md,
// passed in by the shell. That sentence already promised the reader the resume
// has everything in the meantime — this component is that promise kept, so it
// would be strange for it to say something else first.
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
        <p className="text-[13px] leading-relaxed text-text">{headline}</p>
        <p className="text-[12px] leading-relaxed text-text-soft">{MANUAL_COPY.body}</p>
      </div>

      <div>
        <div className="text-[11px] text-text-faint">{MANUAL_COPY.faqHeading}</div>
        <dl className="mt-2 space-y-3">
          {faq.map((chunk) => (
            <div key={chunk.id}>
              <dt className="text-[12px] text-text">{chunk.heading}</dt>
              {chunk.lines.map((line, i) => (
                <dd key={i} className="text-[12px] leading-relaxed text-text-soft">
                  {line}
                </dd>
              ))}
              {/* The id it would have cited, so the manual answer and the
                  assisted one are visibly the same piece of the record. */}
              <dd className="mt-0.5 text-[10px] text-text-faint">{chunk.id}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <div className="text-[11px] text-text-faint">{MANUAL_COPY.corpusHeading}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <ManualLink onClick={() => onOpenSource({ kind: "corpus" })}>
            Every source, listed
          </ManualLink>
          <ManualLink href="/resume">Full resume</ManualLink>
          <ManualLink href="/resume.pdf" external>
            Resume PDF
          </ManualLink>
          <ManualLink href="/projects/adarle20">A Darle 20</ManualLink>
          <ManualLink href="/projects/nokia">Nokia</ManualLink>
          <ManualLink href="/projects/dell-ml">Dell</ManualLink>
          <ManualLink href="mailto:hello@sidhantmathur.com" external>
            Email
          </ManualLink>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-text-faint">{MANUAL_COPY.footer}</p>
    </div>
  );
}

function ManualLink({
  href,
  external,
  onClick,
  children,
}: {
  href?: string;
  external?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const cls =
    "border border-line-strong px-2 py-1 text-[11px] text-text-soft no-underline transition-colors hover:border-accent hover:text-accent";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {children} →
      </button>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {children} ↗
      </a>
    );
  }
  return (
    <Link href={href ?? "/"} className={cls}>
      {children} →
    </Link>
  );
}
