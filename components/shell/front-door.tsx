"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { CaseCards, RecruiterTldr } from "./recruiter-tldr";
import { questionCount } from "./conversation-bar";
import {
  HERO,
  POSITIONING,
  ROLE_LINE,
  SUGGESTED_QUESTIONS as SUGGESTED,
} from "@/content/recruiter";
import { EmailCopy, LinkedInButton, ResumePdfButton } from "@/components/contact-actions";
import { HEADSHOT, SITE_NAME } from "@/lib/site";

// The front door and the affordances that only exist on it: the suggested
// questions, in the hero column below md and in the dock from md up, and the
// row that offers the conversation a reload, Home or Back left behind.
//
// Copy. Final strings come from docs/site-copy.md; drafted ones are logged in
// docs/copy-ledger.md. The H1 is HERO in content/recruiter.ts, beside the rows
// it introduces.

// Short enough to fit beside "clear" on a 375px phone without truncating.
const CONTINUE_LABEL = "Continue where you left off";
const CONTINUE_HINT = "or ask something new to start over";
const CLEAR_LABEL = "clear";

/**
 * The front door: who, what he wants, and three ways to act, before any
 * engagement and in source order at every width. Prose reads in the sans face;
 * everything actionable keeps the mono register of the controls around it.
 * Rendered by the shell only while there is no conversation.
 */
export function FrontDoor({ chips }: { chips: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Name and role in the words a recruiter searches for. The
          photo is small on purpose, a marker beside the name
          rather than a portrait (see the headshot rule in
          app/globals.css). */}
      <div className="flex items-center gap-3">
        <Image
          src={HEADSHOT}
          alt="Sidhant Mathur"
          width={56}
          height={56}
          sizes="56px"
          loading="eager"
          className="headshot h-12 w-12 shrink-0 border border-line-strong object-cover md:h-14 md:w-14"
        />
        <p className="min-w-0 [font-family:var(--font-geist-sans)]">
          <span className="block text-[16px] font-medium leading-snug text-text">
            {SITE_NAME}
          </span>
          <span className="block text-[15px] leading-snug text-text-soft">
            {/* One line from sm up; below it, title and city
                stack, so a phone never starts a line with the
                dot or breaks inside "Toronto, ON". */}
            {ROLE_LINE.value.split(" · ").map((part, i) => (
              <span key={part} className="block sm:inline">
                {i > 0 && <span className="hidden px-1.5 text-text-faint sm:inline">·</span>}
                {part}
              </span>
            ))}
          </span>
        </p>
      </div>
      <h1 className="t-hero max-w-[24ch] font-semibold text-text [font-family:var(--font-geist-sans)] [text-wrap:balance]">
        {/* Non-breaking hyphen: "7-region" stays on one line. */}
        {HERO.replace(/(\d)-/g, "$1‑")}
      </h1>
      {/* Answers "what does he want" without a scroll. The string
          lives in content/recruiter.ts under the same citation
          check as the tl;dr rows — see POSITIONING. */}
      <p className="t-body max-w-[52ch] text-text-soft [font-family:var(--font-geist-sans)] [text-wrap:balance]">
        {POSITIONING.value}
      </p>
      {/* The resume PDF is primary: it's the file a recruiter
          attaches to an ATS record. Which format visitors take is
          still open, so both are tracked. The email is on screen
          and copyable because a bare mailto: is a dead end without
          a mail client. */}
      {/* On a phone: the resume full width, then the address and
          LinkedIn sharing one row, so the summary starts sooner. */}
      <div className="flex flex-col gap-2.5 pt-2 sm:flex-row sm:flex-wrap">
        <ResumePdfButton surface="front-door" primary />
        <div className="flex gap-2.5">
          <EmailCopy surface="front-door" copyFromSm className="min-w-0 flex-1 sm:flex-none" />
          <LinkedInButton surface="front-door" className="shrink-0" />
        </div>
      </div>
      {/* The six-second scan; see recruiter-tldr.tsx. */}
      <div>
        <RecruiterTldr />
      </div>
      {/* Two case studies, one number each. */}
      <CaseCards />
      {/* Below md the chips live here, after the facts; from md
          up they sit in the dock, grouped with the composer they
          feed. See SuggestedChips. */}
      <div className="flex flex-wrap gap-2 pt-1 md:hidden">{chips}</div>
    </div>
  );
}

/**
 * The suggested-question chips, rendered in two places by width: in the dock
 * above the composer from md up, grouped with the interview they start, and in
 * the hero column below md, after the facts, where a phone's fold belongs to
 * the headline and the actions. A fragment, so each chip is a direct child of
 * whichever row holds it (ChipDock's container query counts on that).
 */
export function SuggestedChips({
  onAsk,
  disabled,
}: {
  onAsk: (question: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      {SUGGESTED.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onAsk(q)}
          disabled={disabled}
          // py-2.5 keeps a chip over 44px on a phone, where it is a finger
          // target; from md up the dock is pointer-sized and 36px tall, so it
          // takes less of a 800px laptop screen from the front door.
          className="border border-line-strong px-3 py-2.5 text-left t-meta text-text-soft transition-colors hover:border-accent hover:text-text disabled:border-line disabled:text-text-dim md:py-1.5"
        >
          {q}
        </button>
      ))}
    </>
  );
}

/**
 * From md up the chips sit here, over the composer — the whole interview
 * affordance in one dock: suggested questions, the input, and the proof line
 * under it.
 *
 * One line, never two. The three need about 1,100px side by side, so where the
 * row is narrower — a 1024px window, or a laptop with the context panel open —
 * the last and longest one drops out of the dock. A container query rather
 * than a breakpoint, because the panel narrows the row without the viewport
 * changing. /fit still sends it.
 */
export function ChipDock({ children }: { children: ReactNode }) {
  return (
    <div className="hidden px-4 pt-2.5 md:block md:px-10">
      <div className="@container flex gap-2 [&>:last-child]:hidden @min-[1120px]:[&>:last-child]:block">
        {children}
      </div>
    </div>
  );
}

/**
 * The conversation a reload, Home or Back left behind, one tap from coming
 * back. In the dock at every width, beside the composer that would otherwise
 * replace it, which the hint says rather than letting a new question discard
 * it unannounced.
 */
export function ContinueRow({
  questions,
  hydrated,
  onContinue,
  onClear,
}: {
  /** Questions in the saved conversation. */
  questions: number;
  hydrated: boolean;
  onContinue: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 border-b border-line px-4 text-[14px] md:px-10 md:text-[13px]">
      <button
        type="button"
        onClick={onContinue}
        disabled={!hydrated}
        data-js-control
        className="flex min-h-[44px] min-w-0 touch-manipulation items-center gap-2 text-left text-text transition-colors hover:text-accent"
      >
        <span aria-hidden="true" className="text-accent">
          ↩
        </span>
        <span className="min-w-0 truncate underline decoration-line-strong underline-offset-4">
          {CONTINUE_LABEL}
        </span>
        <span className="hidden shrink-0 text-text-faint sm:inline">
          · {questionCount(questions)}
        </span>
      </button>
      <span className="hidden min-w-0 truncate text-text-faint lg:inline">
        {CONTINUE_HINT}
      </span>
      <button
        type="button"
        onClick={onClear}
        data-js-control
        aria-label="Clear the saved conversation"
        className="ml-auto flex min-h-[44px] shrink-0 touch-manipulation items-center text-text-faint transition-colors hover:text-accent"
      >
        {CLEAR_LABEL}
      </button>
    </div>
  );
}
