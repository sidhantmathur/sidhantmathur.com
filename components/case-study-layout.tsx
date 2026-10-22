import Link from "next/link";
import { ContactActions } from "@/components/contact-actions";
import { DocPage } from "@/components/layout/doc-page";
import { PROJECT_LIST, type ProjectSlug } from "@/content/projects";

type CaseStudyLayoutProps = {
  /** Which case study this is — it decides which one is next. */
  slug: ProjectSlug;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

// How every case study ends: the contact actions and a link to the next one.
// It lives here in the shared layout rather than in each .mdx because the
// prose is Sidhant's copy and is edited on its own schedule.
export const CASE_END_LABEL = "Contact";
export const CASE_END_LINE =
  "If you're hiring for revenue operations or delivery operations, email me. The resume has the rest.";
export const NEXT_CASE_LABEL = "Next case study";

/** The next case study in the site's order, wrapping round. */
function nextOf(slug: ProjectSlug) {
  const at = PROJECT_LIST.findIndex((p) => p.slug === slug);
  return PROJECT_LIST[(at + 1) % PROJECT_LIST.length]!;
}

function CaseStudyEnd({ slug }: { slug: ProjectSlug }) {
  const next = nextOf(slug);
  return (
    <section aria-labelledby="case-end">
      <h2 id="case-end" className="t-label text-text-faint">
        {CASE_END_LABEL}
      </h2>
      <p className="t-body mt-2 max-w-[62ch] text-text-soft">{CASE_END_LINE}</p>
      <div className="mt-4">
        <ContactActions surface="case-study" />
      </div>
      <Link
        href={next.caseStudyHref}
        className="mt-8 block max-w-[62ch] border border-line-strong p-4 no-underline transition-colors hover:border-accent"
      >
        <span className="t-label block text-text-faint">{NEXT_CASE_LABEL}</span>
        <span className="t-head mt-1 block font-medium text-text [font-family:var(--font-geist-sans)]">
          {next.title} →
        </span>
        <span className="t-meta mt-1 block text-text-soft">{next.status}</span>
      </Link>
    </section>
  );
}

export function CaseStudyLayout({ slug, title, subtitle, children }: CaseStudyLayoutProps) {
  return (
    <DocPage footer={<CaseStudyEnd slug={slug} />}>
      <h1 className="t-title font-medium text-text">{title}</h1>
      <p className="t-body mt-3 max-w-[62ch] text-text-soft">{subtitle}</p>
      {/* `case-body` lets app/globals.css size the MDX section heads on the
          page without touching how the same MDX reads in the shell's panel. */}
      <div className="case-body mt-10">{children}</div>
    </DocPage>
  );
}
