import Link from "next/link";
import type { ReactNode } from "react";
import { ContactActions } from "@/components/contact-actions";
import { SITE_NAME } from "@/lib/site";

// Chrome for the document-style routes — /resume, /projects/*, /colophon and
// the rest.
//
// These pages are deliberately still real, server-rendered, crawlable routes:
// search engines index them, they can be pasted into an application, and they
// work with JS off.
//
// WAVE 2: A REAL HEADER. The only chrome used to be "← Back to the
// conversation", which told a reader the chat was home — the framing the
// front-door pass set out to reverse — and offered someone arriving at /resume
// from LinkedIn a conversation they had never had. The header is now the
// site's own: his name (home), Resume, Projects, Contact. Every page also ends
// on the same three ways to act as the front door, under `id="contact"`, which
// is where the header's Contact link goes; a case study passes its own ending
// (see case-study-layout.tsx) and keeps the id.
//
// The wrapper owns its own scroll container because the root body is
// overflow-hidden for the shell. `.doc-prose` is the scope the long-form sans
// rule in app/globals.css applies to.
//
// PHASE 4 renders these same page bodies inside the shell's context panel via
// intercepting routes. Keep the content free of fixed widths and viewport
// units so it reflows into a ~380px column without changes.

const NAV = [
  { label: "Resume", href: "/resume" },
  { label: "Projects", href: "/projects" },
] as const;

const NAV_LINK =
  "flex h-11 touch-manipulation items-center px-2 text-text-soft no-underline transition-colors hover:text-accent sm:px-2.5";

/** The default ending: how to reach him. Drafted copy, logged in the ledger. */
export const DOC_CONTACT_LABEL = "Contact";
export const DOC_CONTACT_LINE =
  "Open to new roles — the resume, an email or LinkedIn, whichever is quickest.";

export function DocContact() {
  return (
    <section aria-labelledby="doc-contact">
      <h2 id="doc-contact" className="t-label text-text-faint">
        {DOC_CONTACT_LABEL}
      </h2>
      <p className="t-body mt-2 max-w-[62ch] text-text-soft">{DOC_CONTACT_LINE}</p>
      <div className="mt-4">
        <ContactActions surface="doc-page" />
      </div>
    </section>
  );
}

export function DocPage({
  children,
  footer,
}: {
  children: ReactNode;
  /** What the page ends on, in place of the contact block. */
  footer?: ReactNode;
}) {
  return (
    <div className="h-dvh overflow-y-auto bg-bg text-text [font-family:var(--font-geist-mono)]">
      <header className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-line bg-panel px-4 text-[13px] md:px-6">
        {/* Fills the strip: a line of text is not a touch target. */}
        <Link
          href="/"
          className="-mx-2 flex h-full touch-manipulation items-center px-2 text-text no-underline transition-colors hover:text-accent"
        >
          {SITE_NAME}
        </Link>
        <nav aria-label="Site" className="-mr-2 ml-auto flex items-center">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={NAV_LINK}>
              {n.label}
            </Link>
          ))}
          {/* A fragment, not a route: every document page ends on the
              contact block, so this works with JavaScript off too. */}
          <a href="#contact" className={NAV_LINK}>
            Contact
          </a>
        </nav>
      </header>
      {/* The bottom pad clears the home indicator on a notched phone; these
          pages own their scroll container, so nothing else does it for them. */}
      <main className="doc-prose mx-auto max-w-[80ch] px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-10 md:px-6">
        {children}
        <div id="contact" className="mt-16 scroll-mt-16 border-t border-line pt-8">
          {footer ?? <DocContact />}
        </div>
      </main>
    </div>
  );
}
