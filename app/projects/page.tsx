import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/layout/doc-page";
import { PROJECT_LIST } from "@/content/projects";

// The index that the three case studies never had.
//
// /projects/adarle20, /projects/nokia and /projects/dell-ml have existed since
// the first build; /projects itself returned a 404. That is a broken promise
// rather than a missing feature — a URL that reads like a section of the site,
// linked from nowhere but typed by anyone who trims a path, and answered with
// "there's nothing at this address" when there are demonstrably three things at
// it.
//
// A redirect to / was the cheaper option and the wrong one. Every other rail
// entry on this site has a real page underneath it, crawlable and pasteable
// (see the note in doc-page.tsx), and the context panel already has a projects
// view that lists exactly these three. This is that view as a page, which makes
// the pattern uniform rather than nearly uniform.
//
// NO NEW FACTS. Every string about the work below comes from content/projects.ts
// — the same source the cards, the chat tool and the panel read, verbatim from
// docs/site-copy.md. The only drafted copy on this page is its own title and the
// sentence under it, both logged in docs/copy-ledger.md.

export const metadata: Metadata = {
  alternates: { canonical: "/projects" },
  title: "Projects",
  description: "Three case studies, and what each one was.",
};

export default function ProjectsPage() {
  return (
    <DocPage>
      <h1 className="t-title font-medium text-text">Projects</h1>
      <p className="t-body mt-3 max-w-[62ch] text-text-soft">
        Three case studies. The conversation will summarise any of them — these are
        the long versions.
      </p>

      <div className="mt-10 space-y-10">
        {PROJECT_LIST.map((project) => (
          <article key={project.slug}>
            {/* The card's corner number, kept: it is how these three are
                ordered everywhere else on the site. */}
            <div className="t-label text-text-faint [font-family:var(--font-geist-mono)]">
              {project.index}
            </div>
            <h2 className="t-head mt-1 font-medium text-text">
              <Link
                href={project.caseStudyHref}
                className="text-text no-underline transition-colors hover:text-accent"
              >
                {project.title}
              </Link>
            </h2>
            <p className="t-body mt-2 max-w-[62ch] text-text-soft">{project.description}</p>
            {/* Same three fields, in the same order, as the context panel's
                project view — so the page and the panel are one design rather
                than two. */}
            <dl className="t-meta mt-3 grid max-w-[62ch] grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-y border-line py-3">
              <dt className="text-text-faint">Role</dt>
              <dd className="text-text-soft">{project.role}</dd>
              <dt className="text-text-faint">Stack</dt>
              <dd className="text-text-soft">{project.stack.join(", ")}</dd>
              <dt className="text-text-faint">Status</dt>
              <dd className="text-text-soft">{project.status}</dd>
            </dl>
            <Link
              href={project.caseStudyHref}
              // Bordered, 44px, the same object as the panel's "Open as a page"
              // and the resume page's links out.
              className="t-meta mt-3 inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2 text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
            >
              Read the case study →
            </Link>
          </article>
        ))}
      </div>
    </DocPage>
  );
}
