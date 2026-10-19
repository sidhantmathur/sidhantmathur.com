"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useHydrated } from "@/components/shell/use-hydrated";
import { EMAIL, LINKEDIN_URL, RESUME_PDF, RESUME_PDF_FILENAME } from "@/lib/site";

// The three ways to act on this site — resume, email, LinkedIn — as one set of
// controls, used by the front door, the end of every document page and the
// contact panel (wave 2).
//
// WHY THE EMAIL IS A BOX AND NOT A BUTTON. "Email me" used to be a bare
// `mailto:`, which on a desktop with no mail client configured does nothing a
// visitor can see. The council review called it a dead end. So the address is
// on screen as text, it is still a mailto for the people it works for, and a
// copy button beside it covers everyone else. If the clipboard is refused
// (an insecure context, a denied permission) the address is selected instead,
// so the next keystroke is Cmd-C rather than a guess.
//
// Every click is tracked with the surface it came from. The synthesis left
// "PDF or HTML resume as the primary button?" open until PostHog could say
// which one visitors actually take; these events are how it will.

export type ContactSurface = "front-door" | "doc-page" | "case-study" | "contact-panel" | "index";

const QUIET =
  "flex h-11 touch-manipulation items-center justify-center border border-line-strong px-4 text-[13px] text-text no-underline transition-colors hover:border-accent hover:text-accent";

const PRIMARY =
  "flex h-11 touch-manipulation items-center justify-center border border-accent bg-accent px-5 text-[13px] font-medium text-bg no-underline transition-opacity hover:opacity-90";

export function ResumePdfButton({
  surface,
  primary = false,
  className = "",
}: {
  surface: ContactSurface;
  /** The front door's one filled control. Everywhere else it is bordered. */
  primary?: boolean;
  className?: string;
}) {
  return (
    <a
      href={RESUME_PDF}
      download={RESUME_PDF_FILENAME}
      onClick={() => track("resume_download", { format: "pdf", surface })}
      className={`${primary ? PRIMARY : QUIET} ${className}`}
    >
      Download resume (PDF)
    </a>
  );
}

export function LinkedInButton({
  surface,
  className = "",
}: {
  surface: ContactSurface;
  className?: string;
}) {
  return (
    <a
      href={LINKEDIN_URL}
      target="_blank"
      rel="noreferrer"
      onClick={() => track("contact_click", { channel: "linkedin", surface })}
      className={`${QUIET} ${className}`}
    >
      LinkedIn ↗
    </a>
  );
}

type CopyState = "idle" | "copied" | "selected";

export function EmailCopy({
  surface,
  className = "",
}: {
  surface: ContactSurface;
  className?: string;
}) {
  // The copy button needs JavaScript, so it is disabled until it has it — the
  // same gate as every other control on the site (see use-hydrated.ts). The
  // address beside it is a plain mailto and works from the first paint.
  const hydrated = useHydrated();
  const [state, setState] = useState<CopyState>("idle");
  const addressRef = useRef<HTMLAnchorElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    let next: CopyState = "copied";
    try {
      await navigator.clipboard.writeText(EMAIL);
      track("contact_click", { channel: "email_copy", surface });
    } catch {
      const el = addressRef.current;
      const selection = window.getSelection();
      if (el && selection) {
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      next = "selected";
    }
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2400);
  }

  return (
    <div className={`flex h-11 items-stretch border border-line-strong ${className}`}>
      <a
        ref={addressRef}
        href={`mailto:${EMAIL}`}
        onClick={() => track("contact_click", { channel: "email_link", surface })}
        className="flex min-w-0 flex-1 touch-manipulation items-center px-3 text-[13px] text-text no-underline transition-colors hover:text-accent"
      >
        {EMAIL}
      </a>
      <button
        type="button"
        onClick={copy}
        disabled={!hydrated}
        data-js-control
        aria-label={`Copy ${EMAIL}`}
        className="flex shrink-0 touch-manipulation items-center border-l border-line-strong px-3 text-[13px] text-text-soft transition-colors hover:text-accent disabled:text-text-dim"
      >
        {state === "copied" ? "copied" : state === "selected" ? "selected" : "copy"}
      </button>
      {/* The label change is visual; this is the same news for a screen
          reader, which the button's fixed aria-label would otherwise hide. */}
      <span role="status" className="sr-only">
        {state === "copied"
          ? "Email address copied."
          : state === "selected"
            ? "Email address selected. Press Command or Control C to copy it."
            : ""}
      </span>
    </div>
  );
}

/** All three, in a row that wraps — the end of a document page. */
export function ContactActions({ surface }: { surface: ContactSurface }) {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
      <ResumePdfButton surface={surface} />
      <EmailCopy surface={surface} />
      <LinkedInButton surface={surface} />
    </div>
  );
}
