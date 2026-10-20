import Link from "next/link";
import type { ReactNode } from "react";
import { ContactActions } from "@/components/contact-actions";
import { SITE_NAME } from "@/lib/site";

// Chrome for the document routes: /resume, /projects/*, /colophon and the
// rest. They are real server-rendered routes so search engines index them,
// they can be pasted into an application, and they work with JS off.
//
// The header is the site's own: his name (home), Resume, Projects, Contact.
// Every page ends on the contact block under `id="contact"`, where the
// header's Contact link goes; a case study passes its own ending
// (case-study-layout.tsx) and keeps the id.
//
// The wrapper owns its scroll container because the root body is
// overflow-hidden for the shell. `.doc-prose` scopes the long-form sans rule
// in app/globals.css.
//
// The case-study bodies (content/*.mdx) also render in the shell's context
// panel (components/shell/panel-body.tsx). Keep page content free of fixed
// widths and viewport units so it reflows into a ~380px column.

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
