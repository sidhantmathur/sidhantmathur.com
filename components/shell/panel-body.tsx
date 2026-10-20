"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Adarle20 from "@/content/adarle20.mdx";
import DellMl from "@/content/dell-ml.mdx";
import Nokia from "@/content/nokia.mdx";
import { PROJECTS } from "@/content/projects";
import { CHUNKS } from "@/lib/chunks.generated";
import { ALL_CHUNKS, ALL_CHUNKS_BY_ID, type Chunk } from "@/lib/corpus";
import { locateMissing, stripCitations } from "@/lib/verify";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { ENFORCEMENT_LABEL, REFUSALS } from "@/lib/refusals";
import type { RequirementVerdict } from "@/lib/role-fit";
import {
  FIT_LABELS,
  fitExcerptNote,
  JD_COPY,
  PROJECT_LINKS,
  SOCIAL_LINKS,
  WHY_CHATBOT,
  WHY_CHATBOT_HEADING,
} from "./shell-data";
import { EmailCopy, ResumePdfButton } from "@/components/contact-actions";
import type { PanelView, RoleFit } from "./use-conversation";
import { MAX_POSTING_TEXT } from "@/lib/job-posting";
import { COLOPHON_STACK } from "@/lib/site";
import { ActionLink } from "./action-link";

const CASE_STUDIES = {
  adarle20: Adarle20,
  nokia: Nokia,
  "dell-ml": DellMl,
} as const;

// Sits under the corpus index (docs/idea-decisions.md #8). Both halves are true
// in code: the knowledge base is in every system prompt, and the repo corpus is
// appended only when lib/site-question.ts recognises the turn.
const CORPUS_NOTE =
  "Two corpora. The record above — the resume, the projects, the FAQ — rides inside the prompt on every turn. This site's own source is the second one, and it is only loaded when you ask about the site, so an ordinary answer never pays for it.";

// The prompt and refusals panels' framing. Both restate what the code does and
// say nothing about Sidhant.
const PROMPT_NOTE = {
  intro:
    "Everything the model was told before it read your question, in order. It is published in full, and this list is read out of the prompt itself rather than kept beside it.",
  decline:
    "Ask it in the chat to recite them and it will decline and link here — the prompt is public, but talking it out of that rule is the first move in talking it out of the others.",
};

const REFUSALS_NOTE =
  "What it won't do, and what it does instead. The label on the right says whether the rule is enforced by code or asked of the model, because those are not the same promise.";

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
          <ActionLink href="/resume">Full resume</ActionLink>
          <ActionLink href="/resume.pdf" external>
            PDF
          </ActionLink>
        </div>
      </div>
    );
  }

  // A cited chunk renders its whole file with the chunk highlighted: checking
  // a citation means reading what sits around it.
  if (panel.kind === "source") {
    const chunk = ALL_CHUNKS_BY_ID[panel.id];
    if (!chunk) return null;
    return (
      <div className="space-y-6">
        {ALL_CHUNKS.filter((c) => c.source === chunk.source).map((c) => (
          <ChunkBlock key={c.id} chunk={c} focused={c.id === chunk.id} showId />
        ))}
      </div>
    );
  }

  // Everything the site could cite, by file, with each chunk's id: the other
  // direction from the citation margin, which shows what one answer used.
  if (panel.kind === "corpus") {
    const bySource = new Map<string, Chunk[]>();
    for (const chunk of ALL_CHUNKS) {
      const list = bySource.get(chunk.sourceLabel) ?? [];
      list.push(chunk);
      bySource.set(chunk.sourceLabel, list);
    }
    return (
      <div className="space-y-5">
        {[...bySource.entries()].map(([label, chunks]) => (
          <div key={label}>
            <div className="t-label text-text-faint">{label}</div>
            <div className="mt-1 flex flex-col">
              {chunks.map((chunk) => (
                <button
                  key={chunk.id}
                  type="button"
                  onClick={() => onOpenSource?.({ kind: "source", id: chunk.id })}
                  className="t-meta flex min-h-[44px] w-full items-center border-b border-line py-2.5 text-left text-text-soft transition-colors last:border-b-0 hover:text-accent"
                >
                  {chunk.heading}
                  <span className="ml-2 t-label text-text-faint">{chunk.id}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="t-meta text-text-faint">{CORPUS_NOTE}</p>
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
            className="t-meta block border border-line-strong p-3 text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
          >
            {l.label} →
          </Link>
        ))}
        <div className="pt-1">
          <ActionLink href="/projects">Open as a page</ActionLink>
        </div>
      </div>
    );
  }

  if (panel.kind === "contact") {
    // The address on screen and copyable, as on the front door: a bare mailto
    // does nothing on a desktop with no mail client.
    return (
      <div className="space-y-2">
        <EmailCopy surface="contact-panel" />
        <ResumePdfButton surface="contact-panel" />
        {SOCIAL_LINKS.filter((s) => s.label !== "Email").map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noreferrer"
            className="t-meta block border border-line-strong p-3 text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
          >
            {s.label} ↗
          </a>
        ))}
      </div>
    );
  }

  if (panel.kind === "project") {
    // The same MDX the standalone route renders; mdx-components.tsx styles it
    // for both.
    const project = PROJECTS[panel.slug];
    const Body = CASE_STUDIES[panel.slug];
    return (
      <div className="space-y-4">
        <p className="t-meta text-text-faint">{project.description}</p>
        <dl className="t-meta grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-y border-line py-3">
          <dt className="text-text-faint">Role</dt>
          <dd className="text-text-soft">{project.role}</dd>
          <dt className="text-text-faint">Stack</dt>
          <dd className="text-text-soft">{project.stack.join(", ")}</dd>
          <dt className="text-text-faint">Status</dt>
          <dd className="text-text-soft">{project.status}</dd>
        </dl>
        <Body />
        <ActionLink href={project.caseStudyHref}>Open as a page</ActionLink>
      </div>
    );
  }

  if (panel.kind === "colophon") {
    return (
      <div className="space-y-3">
        <p className="t-body text-text-soft">{COLOPHON_STACK}</p>
        <div className="flex flex-wrap gap-2">
          <ActionLink href="/colophon">Open as a page</ActionLink>
          <ActionLink href="/measurements">What it scores</ActionLink>
          <ActionLink href="/prompt">Its instructions</ActionLink>
          <ActionLink href="/refusals">What it won&apos;t do</ActionLink>
        </div>
        <h3 className="t-label pt-3 text-text-faint">{WHY_CHATBOT_HEADING}</h3>
        {WHY_CHATBOT.map((para, i) => (
          <p key={i} className="t-meta text-text-soft">
            {para}
          </p>
        ))}
      </div>
    );
  }

  // The published prompt (#7) belongs on its own page; beside a conversation it
  // is a list of its sections, read off the prompt itself so a renamed or added
  // section shows up without an edit here.
  if (panel.kind === "prompt") {
    const sections = buildSystemPrompt()
      .split("\n")
      .filter((l) => l.startsWith("## "))
      .map((l) => l.slice(3));
    return (
      <div className="space-y-3">
        <p className="t-meta text-text-soft">{PROMPT_NOTE.intro}</p>
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s} className="t-meta border-b border-line py-2 text-text-soft">
              {s}
            </li>
          ))}
        </ul>
        <p className="t-meta text-text-faint">{PROMPT_NOTE.decline}</p>
        <ActionLink href="/prompt">Read the whole thing</ActionLink>
      </div>
    );
  }

  // The refusal ledger (#10) renders in full; the /refusals page adds the
  // reasons.
  if (panel.kind === "refusals") {
    return (
      <div className="space-y-4">
        <p className="t-meta text-text-soft">{REFUSALS_NOTE}</p>
        <div>
          {REFUSALS.map((r) => (
            <div key={r.id} className="border-b border-line py-2.5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="t-meta text-text">{r.title}</span>
                <span className="t-label shrink-0 text-text-faint">
                  {ENFORCEMENT_LABEL[r.enforcedBy]}
                </span>
              </div>
              <p className="t-meta mt-1 text-text-soft">{r.instead}</p>
            </div>
          ))}
        </div>
        <ActionLink href="/refusals">Why each one exists</ActionLink>
      </div>
    );
  }

  if (panel.kind === "roleFit") {
    return <RequirementTable fit={panel.data} onOpenSource={onOpenSource} />;
  }

  return null;
}

// --- RequirementTable -------------------------------------------------------
//
// One row per requirement the posting stated, each with a verdict and a source
// it either has or is marked for not having.
//
// Four crisp tags look more precise than the assessment under them
// (docs/idea-decisions.md §3). So there is no score, percentage, weighting or
// ordering by verdict: rows stay in the posting's order, the counts are counts,
// and the line under them says what a tag is. A row that code changed says so
// next to the row.

const VERDICT_STYLE: Record<RequirementVerdict, string> = {
  met: "border-line-strong text-text",
  partial: "border-line-strong text-text-soft",
  unmet: "border-accent text-accent",
  unclear: "border-dashed border-line-strong text-text-faint",
};

/** Counts, in a fixed order so the row doesn't reshuffle between answers. */
const COUNT_ORDER: RequirementVerdict[] = ["met", "partial", "unmet", "unclear"];

const ROLE_FIT_UNREADABLE =
  "This assessment was saved by an older version of the site and can't be shown. Paste the posting again to rebuild it.";

function RequirementTable({
  fit,
  onOpenSource,
}: {
  fit: RoleFit | undefined;
  onOpenSource?: (view: PanelView) => void;
}) {
  const partial = (fit ?? {}) as Partial<RoleFit>;

  // A result without the shape this renders is a message, not a crash: a throw
  // during render takes down the whole shell. Old stored conversations are
  // retired by the storage-key bump in use-conversation.ts, but a permalink
  // carries the same object in a URL, so the shape is checked here.
  if (!Array.isArray(partial.rows) || !partial.counts || !Array.isArray(partial.gaps)) {
    return <p className="t-meta text-text-faint">{ROLE_FIT_UNREADABLE}</p>;
  }

  const { rows, counts, gaps, noGapsRationale, verdict } = partial as RoleFit;
  // More verdicts counted than rows present: this is the short fit link's
  // excerpt, and it says so before the first row (see fitExcerptNote).
  const total = COUNT_ORDER.reduce((sum, v) => sum + (counts[v] ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="t-meta flex flex-wrap gap-x-3 gap-y-1 border-b border-line pb-3 text-text-faint">
        {COUNT_ORDER.filter((v) => counts[v] > 0).map((v) => (
          <span key={v}>
            <span className="tabular-nums text-text-soft">{counts[v]}</span> {v}
          </span>
        ))}
        {total > rows.length && (
          <p className="w-full pt-1 text-text-soft">{fitExcerptNote(rows.length, total)}</p>
        )}
      </div>

      <div>
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[72px_1fr] gap-3 border-b border-line py-3 last:border-b-0"
          >
            <span
              className={`mt-0.5 self-start border px-1 py-0.5 text-center t-label tracking-[0.07em] ${VERDICT_STYLE[row.verdict]}`}
            >
              {row.verdict}
            </span>
            <div>
              {/* The posting's words, not the site's — the input, not a claim. */}
              <p className="t-meta text-text">{row.requirement}</p>
              {row.evidence && (
                <p className="t-meta mt-1 text-text-soft">
                  {stripCitations(row.evidence)}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 t-label text-text-faint">
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
                {/* Same split as an answer's marks: a token the record holds
                    under another chunk is a pointer problem and is said
                    quietly; only one the record has nowhere keeps the accent. */}
                {row.unverified.length > 0 && <RowMark row={row} />}
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
          <div className="t-label text-text-faint">{FIT_LABELS.gaps}</div>
          <ul className="mt-1 space-y-1">
            {gaps.map((gap, i) => (
              <li key={i} className="t-meta text-text-soft">
                {stripCitations(gap)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!gaps.length && noGapsRationale && (
        <div className="border-t border-line pt-3">
          <div className="t-label text-text-faint">{FIT_LABELS.noGaps}</div>
          <p className="t-meta mt-1 text-text-soft">
            {stripCitations(noGapsRationale)}
          </p>
        </div>
      )}

      {verdict && (
        <p className="t-meta border-t border-line pt-3 text-text">
          {stripCitations(verdict)}
        </p>
      )}

      <p className="t-meta text-text-faint">{FIT_LABELS.notAScore}</p>
    </div>
  );
}

/**
 * A cited row's missing tokens, split the way lib/verify.ts splits an answer's:
 * in the record under another chunk (quiet), or nowhere in it (the accent).
 */
function RowMark({ row }: { row: RoleFit["rows"][number] }) {
  const { absent, elsewhere } = locateMissing(row.unverified, row.sources, ALL_CHUNKS_BY_ID);
  if (absent.length) {
    return <span className="text-accent">not in the record · {absent.join(", ")}</span>;
  }
  return (
    <span>
      not in cited source · {row.unverified.join(", ")}
      {elsewhere.length > 0 && <> — in {elsewhere.join(", ")}</>}
    </span>
  );
}

/** `resume:nokia` → `Resume — Nokia, Toronto ON`, for a row's source link. */
function sourceTitle(id: string): string {
  const chunk = ALL_CHUNKS_BY_ID[id];
  return chunk ? `${chunk.sourceLabel} — ${chunk.heading}` : id;
}

// The route's cap on a user turn less the prefix sent ahead of the posting, so
// the textarea enforces exactly the server's limit.
const JD_MAX = MAX_POSTING_TEXT;

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
      <p className="t-meta text-text-soft">{JD_COPY.body}</p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, JD_MAX))}
        placeholder={JD_COPY.placeholder}
        rows={12}
        // 16px below md: iOS Safari zooms into any field under 16px on focus
        // and doesn't zoom back out.
        className="w-full resize-y border border-line-strong bg-raised p-2 text-[16px] leading-relaxed text-text outline-none placeholder:text-text-faint focus:border-accent md:text-[14px]"
      />
      <div className="flex items-center justify-between">
        <span className="t-label tabular-nums text-text-faint">
          {value.length}/{JD_MAX}
        </span>
        <button
          type="submit"
          disabled={!trimmed}
          className="flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 t-meta text-text-soft transition-colors hover:border-accent hover:text-accent disabled:border-line disabled:text-text-dim"
        >
          {JD_COPY.submit} →
        </button>
      </div>
    </form>
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
      <div className={`t-meta ${focused ? "text-accent" : "text-text"}`}>
        {chunk.heading}
      </div>
      {showId && <div className="mt-0.5 t-label text-text-faint">{chunk.id}</div>}
      {chunk.meta && <div className="t-meta mt-0.5 text-text-faint">{chunk.meta}</div>}
      <ul className="mt-2 space-y-2">
        {chunk.lines.map((b, i) => (
          <li key={i} className="t-meta text-text-soft">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}
