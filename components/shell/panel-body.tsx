"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  PROJECT_LINKS,
  RESUME_SECTIONS,
  SOCIAL_LINKS,
  WHY_CHATBOT,
  type ResumeSection,
} from "./shell-data";
import type { PanelView } from "./use-conversation";

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
        {RESUME_SECTIONS.map((s) => (
          <ResumeBlock key={s.id} section={s} focused={panel.focus === s.id} />
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

function ResumeBlock({ section, focused }: { section: ResumeSection; focused: boolean }) {
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
        {section.heading}
      </div>
      <div className="mt-0.5 text-[11px] text-text-faint">{section.meta}</div>
      <ul className="mt-2 space-y-2">
        {section.bullets.map((b, i) => (
          <li key={i} className="text-[12px] leading-relaxed text-text-soft">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
