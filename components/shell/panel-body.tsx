"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Adarle20 from "@/content/adarle20.mdx";
import DellMl from "@/content/dell-ml.mdx";
import Nokia from "@/content/nokia.mdx";
import { PROJECTS } from "@/content/projects";
import { CHUNKS, CHUNK_BY_ID, type Chunk } from "@/lib/chunks.generated";
import { JD_COPY, PROJECT_LINKS, SOCIAL_LINKS, WHY_CHATBOT } from "./shell-data";
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
    case "jd":
      return JD_COPY.heading;
    // Rendered by app-shell, not PanelBody — the deck is instrument state, not
    // content. The title still belongs here so both panel chromes agree.
    case "instruments":
      return "Instruments";
    case "project":
      return PROJECTS[panel.slug].title;
    case "source": {
      const chunk = CHUNK_BY_ID[panel.id];
      return chunk ? `${chunk.sourceLabel} — ${chunk.heading}` : panel.id;
    }
    case "roleFit":
      return `Role fit — ${panel.data.role}`;
    default:
      return "";
  }
}

export function PanelBody({
  panel,
  onSubmitJd,
}: {
  panel: PanelView;
  onSubmitJd?: (text: string) => void;
}) {
  if (panel.kind === "jd") {
    return <JobDescriptionForm onSubmit={onSubmitJd} />;
  }

  if (panel.kind === "resume") {
    return (
      <div className="space-y-6">
        {CHUNKS.filter((c) => c.source === "resume").map((c) => (
          <ChunkBlock key={c.id} chunk={c} focused={panel.focus === c.id} />
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

  // A cited chunk. The whole file renders rather than the one chunk, because a
  // citation is an invitation to check the answer and checking means reading
  // what sits around the sentence — the id is what gets highlighted.
  if (panel.kind === "source") {
    const chunk = CHUNK_BY_ID[panel.id];
    if (!chunk) return null;
    return (
      <div className="space-y-6">
        {CHUNKS.filter((c) => c.source === chunk.source).map((c) => (
          <ChunkBlock key={c.id} chunk={c} focused={c.id === chunk.id} showId />
        ))}
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

// The API caps a user turn at 4000 characters, so the textarea enforces the
// same limit rather than letting a long posting fail server-side.
const JD_MAX = 3500;

function JobDescriptionForm({ onSubmit }: { onSubmit?: (text: string) => void }) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed || !onSubmit) return;
        onSubmit(trimmed.slice(0, JD_MAX));
        setValue("");
      }}
    >
      <p className="text-[12px] leading-relaxed text-text-soft">{JD_COPY.body}</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, JD_MAX))}
        placeholder={JD_COPY.placeholder}
        rows={12}
        className="w-full resize-y border border-line-strong bg-raised p-2 text-[12px] leading-relaxed text-text outline-none placeholder:text-text-faint focus:border-accent"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-faint">
          {value.length}/{JD_MAX}
        </span>
        <button
          type="submit"
          disabled={!trimmed}
          className="border border-line-strong px-2 py-1 text-[11px] text-text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {JD_COPY.submit} →
        </button>
      </div>
    </form>
  );
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

function ChunkBlock({
  chunk,
  focused,
  showId,
}: {
  chunk: Chunk;
  focused: boolean;
  /** Print the citation id, so a reader can see what the answer named. */
  showId?: boolean;
}) {
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
        {chunk.heading}
      </div>
      {showId && <div className="mt-0.5 text-[10px] text-text-faint">{chunk.id}</div>}
      {chunk.meta && <div className="mt-0.5 text-[11px] text-text-faint">{chunk.meta}</div>}
      <ul className="mt-2 space-y-2">
        {chunk.lines.map((b, i) => (
          <li key={i} className="text-[12px] leading-relaxed text-text-soft">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
