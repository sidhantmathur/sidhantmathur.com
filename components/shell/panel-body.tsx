"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Adarle20 from "@/content/adarle20.mdx";
import DellMl from "@/content/dell-ml.mdx";
import Nokia from "@/content/nokia.mdx";
import { PROJECTS } from "@/content/projects";
import { CHUNKS, CHUNK_BY_ID, type Chunk } from "@/lib/chunks.generated";
import { stripCitations } from "@/lib/verify";
import type { RequirementVerdict } from "@/lib/role-fit";
import { FIT_LABELS, JD_COPY, PROJECT_LINKS, SOCIAL_LINKS, WHY_CHATBOT } from "./shell-data";
import type { PanelView, RoleFit } from "./use-conversation";

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
    // Rendered by app-shell for the same reason as the deck: the export
    // surface is conversation state, not content.
    case "export":
      return "Export";
    case "corpus":
      return "Sources";
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
  onOpenSource,
}: {
  panel: PanelView;
  onSubmitJd?: (text: string) => void;
  /** Opens a cited chunk — the requirement table's rows link into the corpus. */
  onOpenSource?: (view: PanelView) => void;
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

  // The whole corpus, by file, with the id each chunk answers to (Sprint 5,
  // #13's `/sources`). The citation margin shows the ids an ANSWER used; this
  // is the other direction — everything the site could ever cite, listed once,
  // so "what is this built from" is a question with a visible answer rather
  // than one you have to ask the model.
  if (panel.kind === "corpus") {
    const bySource = new Map<string, Chunk[]>();
    for (const chunk of CHUNKS) {
      const list = bySource.get(chunk.sourceLabel) ?? [];
      list.push(chunk);
      bySource.set(chunk.sourceLabel, list);
    }
    return (
      <div className="space-y-5">
        {[...bySource.entries()].map(([label, chunks]) => (
          <div key={label}>
            <div className="text-[11px] text-text-faint">{label}</div>
            <div className="mt-1 flex flex-col">
              {chunks.map((chunk) => (
                <button
                  key={chunk.id}
                  type="button"
                  onClick={() => onOpenSource?.({ kind: "source", id: chunk.id })}
                  className="border-b border-line py-1.5 text-left text-[12px] text-text-soft transition-colors last:border-b-0 hover:text-accent"
                >
                  {chunk.heading}
                  <span className="ml-2 text-[10px] text-text-faint">{chunk.id}</span>
                </button>
              ))}
            </div>
          </div>
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
        <div className="flex flex-wrap gap-2">
          <PanelLink href="/colophon">Open as a page</PanelLink>
          <PanelLink href="/measurements">What it scores</PanelLink>
        </div>
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
    return <RequirementTable fit={panel.data} onOpenSource={onOpenSource} />;
  }

  return null;
}

// --- requirementTable (roadmap Sprint 4: #11, rendering bank §6 Stage 1) ----
//
// The first named component in the generative-UI vocabulary, and the shape that
// makes the honesty work visible: one row per requirement the posting stated,
// each with a verdict the model can't quietly skip and a source it either has
// or is marked for not having.
//
// THE RENDERING CONSTRAINT (decisions §3): four crisp tags look more precise
// than the assessment underneath them. So there is no score, no percentage, no
// weighting, and no ordering by verdict — the rows stay in the posting's order,
// the counts are counts, and the line under them says what a tag is. A row that
// code changed says who changed it and why, next to the row it changed.

const VERDICT_STYLE: Record<RequirementVerdict, string> = {
  met: "border-line-strong text-text",
  partial: "border-line-strong text-text-soft",
  unmet: "border-accent text-accent",
  unclear: "border-dashed border-line-strong text-text-faint",
};

/** Counts, in a fixed order so the row doesn't reshuffle between answers. */
const COUNT_ORDER: RequirementVerdict[] = ["met", "partial", "unmet", "unclear"];

function RequirementTable({
  fit,
  onOpenSource,
}: {
  fit: RoleFit;
  onOpenSource?: (view: PanelView) => void;
}) {
  const { rows, counts, gaps, noGapsRationale, verdict } = fit;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-b border-line pb-3 text-[11px] text-text-faint">
        {COUNT_ORDER.filter((v) => counts[v] > 0).map((v) => (
          <span key={v}>
            <span className="tabular-nums text-text-soft">{counts[v]}</span> {v}
          </span>
        ))}
      </div>

      <div>
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[58px_1fr] gap-3 border-b border-line py-3 last:border-b-0"
          >
            <span
              className={`mt-0.5 self-start border px-1 py-0.5 text-center text-[9.5px] uppercase tracking-[0.07em] ${VERDICT_STYLE[row.verdict]}`}
            >
              {row.verdict}
            </span>
            <div>
              {/* The posting's words, not the site's — the input, not a claim. */}
              <p className="text-[12px] leading-snug text-text">{row.requirement}</p>
              {row.evidence && (
                <p className="mt-1 text-[12px] leading-relaxed text-text-soft">
                  {stripCitations(row.evidence)}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-text-faint">
                {row.sources.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onOpenSource?.({ kind: "source", id })}
                    title={sourceTitle(id)}
                    className="text-text-faint transition-colors hover:text-accent"
                  >
                    {id}
                  </button>
                ))}
                {row.downgrade === "uncited" && (
                  <span className="text-accent">
                    cited no source — downgraded from {row.claimedVerdict}
                  </span>
                )}
                {row.downgrade === "uncovered" && (
                  <span>the assessment didn&apos;t answer this one</span>
                )}
                {row.downgrade === "unjudged" && (
                  <span>the assessment restated this one without judging it</span>
                )}
                {row.unverified.length > 0 && (
                  <span className="text-accent">
                    unverified · {row.unverified.join(", ")} — not in {row.sources.join(", ")}
                  </span>
                )}
                {row.unknownSources.length > 0 && (
                  <span className="text-accent">
                    cited {row.unknownSources.join(", ")}, which isn&apos;t a source on this site
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {gaps.length > 0 && (
        <div className="border-t border-line pt-3">
          <div className="text-[11px] text-text-faint">{FIT_LABELS.gaps}</div>
          <ul className="mt-1 space-y-1">
            {gaps.map((gap, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-text-soft">
                {stripCitations(gap)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!gaps.length && noGapsRationale && (
        <div className="border-t border-line pt-3">
          <div className="text-[11px] text-text-faint">{FIT_LABELS.noGaps}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-text-soft">
            {stripCitations(noGapsRationale)}
          </p>
        </div>
      )}

      {verdict && (
        <p className="border-t border-line pt-3 text-[12px] leading-relaxed text-text">
          {stripCitations(verdict)}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-text-faint">{FIT_LABELS.notAScore}</p>
    </div>
  );
}

/** `resume:nokia` → `Resume — Nokia, Toronto ON`, for a row's source link. */
function sourceTitle(id: string): string {
  const chunk = CHUNK_BY_ID[id];
  return chunk ? `${chunk.sourceLabel} — ${chunk.heading}` : id;
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
        // 16px below md for the same reason as the ask input: iOS Safari
        // zooms into any field under 16px on focus and does not zoom back out.
        // Pasting a job posting is the longest interaction on the site — it is
        // the worst place to strand someone at 1.4x.
        className="w-full resize-y border border-line-strong bg-raised p-2 text-[16px] leading-relaxed text-text outline-none placeholder:text-text-faint focus:border-accent md:text-[12px]"
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
