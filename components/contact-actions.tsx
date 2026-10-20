"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useHydrated } from "@/components/shell/use-hydrated";
import { EMAIL, LINKEDIN_URL, RESUME_PDF, RESUME_PDF_FILENAME } from "@/lib/site";

// The three ways to act on this site (resume, email, LinkedIn) as one set of
// controls, shared by every surface in ContactSurface.
//
// The email is on screen as text rather than a bare mailto, which does nothing
// visible on a desktop with no mail client. It is still a mailto link, and the
// copy button beside it covers everyone else. If the clipboard is refused (an
// insecure context, a denied permission) the address is selected instead, so
// the next keystroke is Cmd-C.
//
// Every click is tracked with the surface it came from: which resume format
// visitors take is an open question until PostHog answers it (the CTA row note
// in docs/site-copy.md).

// "replay" is the banner over a replayed conversation — in practice, a fit
// check sent with an application (docs/application-links.md).
export type ContactSurface =
  | "front-door"
  | "doc-page"
  | "case-study"
  | "contact-panel"
  | "index"
  | "replay";

const QUIET =
  "flex h-11 touch-manipulation items-center justify-center border border-line-strong px-4 t-meta text-text no-underline transition-colors hover:border-accent hover:text-accent";

const PRIMARY =
  "flex h-11 touch-manipulation items-center justify-center border border-accent bg-accent px-5 t-meta font-medium text-bg no-underline transition-opacity hover:opacity-90";

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

// A text link rather than a button, for a row of text links beside it.
const TEXT_LINK =
  "flex min-h-[44px] touch-manipulation items-center text-text-soft underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent";

export function LinkedInButton({
  surface,
  className = "",
  asLink = false,
}: {
  surface: ContactSurface;
  className?: string;
  asLink?: boolean;
}) {
  return (
    <a
      href={LINKEDIN_URL}
      target="_blank"
      rel="noreferrer"
      onClick={() => track("contact_click", { channel: "linkedin", surface })}
      className={`${asLink ? TEXT_LINK : QUIET} ${className}`}
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
  // The copy button is disabled until hydration, like every other control
  // that needs JavaScript (see use-hydrated.ts). The address beside it is a
  // plain mailto and works from the first paint.
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
        className="flex min-w-0 flex-1 touch-manipulation items-center px-3 t-meta text-text no-underline transition-colors hover:text-accent"
      >
        {EMAIL}
      </a>
      <button
        type="button"
        onClick={copy}
        disabled={!hydrated}
        data-js-control
        aria-label={`Copy ${EMAIL}`}
        className="flex shrink-0 touch-manipulation items-center border-l border-line-strong px-3 t-meta text-text-soft transition-colors hover:text-accent disabled:text-text-dim"
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
