"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Adarle20 from "@/content/adarle20.mdx";
import DellMl from "@/content/dell-ml.mdx";
import Nokia from "@/content/nokia.mdx";
import { PROJECTS } from "@/content/projects";
import { CITATIONS, type Citation } from "@/lib/citations.generated";
import { PROJECT_LINKS, SOCIAL_LINKS, WHY_CHATBOT } from "./shell-data";
import type { PanelView } from "./use-conversation";

const CASE_STUDIES = {
  adarle20: Adarle20,
  nokia: Nokia,
  "dell-ml": DellMl,
} as const;

export function panelTitle(panel: PanelView): string {
  switch (panel.kind) {
    case "resume":
      return "Resume";
    case "projects":
      return "Projects";
    case "contact":
      return "Contact";
    case "why":
      return "Why this site is a chatbot";
    case "colophon":
      return "How this site was built";
    case "project":
      return PROJECTS[panel.slug].title;
    case "roleFit":
      return `Role fit — ${panel.data.role}`;
    default:
      return "";
  }
}

export function PanelBody({ panel }: { panel: PanelView }) {
  if (panel.kind === "resume") {
    return (
      <div className="space-y-6">
        {CITATIONS.map((c) => (
          <ResumeBlock key={c.id} citation={c} focused={panel.focus === c.id} />
        ))}
        <div className="flex flex-wrap gap-2">
          <PanelLink href="/resume">Full resume</PanelLink>
          <PanelLink href="/resume.pdf" external>
            PDF
          </PanelLink>
        </div>
      </div>
    );
  }

  if (panel.kind === "projects") {
    return (
      <div className="space-y-2">
        {PROJECT_LINKS.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className="block border border-line-strong p-3 text-[12px] text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
          >
            {l.label} →
          </Link>
        ))}
      </div>
    );
  }

  if (panel.kind === "contact") {
    return (
      <div className="space-y-2">
        {SOCIAL_LINKS.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noreferrer"
            className="block border border-line-strong p-3 text-[12px] text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
          >
            {s.label} ↗
          </a>
        ))}
      </div>
    );
  }

  if (panel.kind === "project") {
    // The same MDX the standalone route renders — one source of content, two
    // presentations. mdx-components.tsx styles it for both.
    const project = PROJECTS[panel.slug];
    const Body = CASE_STUDIES[panel.slug];
    return (
      <div className="space-y-4">
        <p className="text-[12px] leading-relaxed text-text-faint">{project.description}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-y border-line py-3 text-[11px]">
          <dt className="text-text-faint">Role</dt>
          <dd className="text-text-soft">{project.role}</dd>
          <dt className="text-text-faint">Stack</dt>
          <dd className="text-text-soft">{project.stack.join(", ")}</dd>
          <dt className="text-text-faint">Status</dt>
          <dd className="text-text-soft">{project.status}</dd>
        </dl>
        <Body />
        <PanelLink href={project.caseStudyHref}>Open as a page</PanelLink>
      </div>
    );
  }

  if (panel.kind === "colophon") {
    return (
      <div className="space-y-3">
        <p className="text-[13px] leading-[1.7] text-text-soft">
          Next.js, TypeScript, and Tailwind, deployed on Vercel. Type is Geist Sans and
          Geist Mono. The chat assistant runs on Claude through Vercel&apos;s AI Gateway,
          with the knowledge base injected directly into the prompt — at this scale, a
          vector database would be complexity for its own sake, so there isn&apos;t one.
        </p>
        <PanelLink href="/colophon">Open as a page</PanelLink>
      </div>
    );
  }

  if (panel.kind === "why") {
    return (
      <div className="space-y-4">
        {WHY_CHATBOT.map((para, i) => (
          <p key={i} className="text-[12px] leading-relaxed text-text-soft">
            {para}
          </p>
        ))}
        <PanelLink href="/colophon">How it&apos;s built</PanelLink>
      </div>
    );
  }

  if (panel.kind === "roleFit") {
    const { matches, caveats } = panel.data;
    return (
      <div className="space-y-4">
        {matches.map((m, i) => (
          <div key={i} className="border-l-2 border-accent pl-3">
            <div className="text-[12px] text-text">{m.area}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-text-soft">{m.evidence}</p>
          </div>
        ))}
        {caveats && (
          <div className="border-t border-line pt-3">
            <div className="text-[11px] text-text-faint">Worth knowing</div>
            <p className="mt-1 text-[12px] leading-relaxed text-text-soft">{caveats}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function PanelLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    "inline-block border border-line-strong px-2 py-1 text-[11px] text-text-soft no-underline transition-colors hover:border-accent hover:text-accent";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {children} ↗
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children} →
    </Link>
  );
}

function ResumeBlock({ citation, focused }: { citation: Citation; focused: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focused]);

  return (
    <div
      ref={ref}
      className={`border-l-2 pl-3 transition-colors ${focused ? "border-accent" : "border-line"}`}
    >
      <div className={`text-[12px] ${focused ? "text-accent" : "text-text"}`}>
        {citation.heading}
      </div>
      {citation.meta && (
        <div className="mt-0.5 text-[11px] text-text-faint">{citation.meta}</div>
      )}
      <ul className="mt-2 space-y-2">
        {citation.bullets.map((b, i) => (
          <li key={i} className="text-[12px] leading-relaxed text-text-soft">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
