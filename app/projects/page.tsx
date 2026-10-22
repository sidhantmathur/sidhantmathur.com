import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/layout/doc-page";
import { PROJECT_LIST } from "@/content/projects";

// The three case studies as a page: the standalone version of the context
// panel's projects view, and what anyone who trims a case study's URL lands on.
//
// Every string about the work comes from content/projects.ts. The page's own
// title, intro and metadata are drafted copy, logged in docs/copy-ledger.md.

export const metadata: Metadata = {
  alternates: { canonical: "/projects" },
  title: "Projects",
  description:
    "Three case studies: reporting tools at Nokia, the A Darle 20 marketplace, and a sales prediction model at Dell.",
};

export default function ProjectsPage() {
  return (
    <DocPage>
      <h1 className="t-title font-medium text-text">Projects</h1>
      <p className="t-body mt-3 max-w-[62ch] text-text-soft">
        Three things I built for sales and revenue teams: Nokia&apos;s
        quarter-end and sales reporting, a live marketplace I built as its only
        developer, and the Dell sales model where this work started.
      </p>

      <div className="mt-10 space-y-10">
        {PROJECT_LIST.map((project) => (
          <article key={project.slug}>
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
                project view. */}
            <dl className="t-meta mt-3 grid max-w-[62ch] grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-y border-line py-3">
              <dt className="text-text-faint">Role</dt>
              <dd className="text-text-soft">{project.role}</dd>
              <dt className="text-text-faint">Stack</dt>
              <dd className="text-text-soft">{project.stack.join(", ")}</dd>
              <dt className="text-text-faint">Status</dt>
              <dd className="text-text-soft">{project.status}</dd>
            </dl>
            {/* The two current pieces of work get the bordered control; the
                2018 internship gets a quiet link, so it reads as where the
                work started rather than as a third peer. */}
            <Link
              href={project.caseStudyHref}
              // The same bordered 44px control as the panel's "Open as a page".
              className={
                project.slug === "dell-ml"
                  ? "t-meta mt-1 inline-flex min-h-[44px] items-center text-text-soft underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                  : "t-meta mt-3 inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2 text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
              }
            >
              Read the case study →
            </Link>
          </article>
        ))}
      </div>
    </DocPage>
  );
}
