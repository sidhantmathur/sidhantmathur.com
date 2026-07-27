// Serializes a conversation to markdown for the clipboard.
//
// This is the storage-free answer to "can I keep this?" — a recruiter who has a
// useful conversation can paste it into an email, a Slack thread, or an ATS
// note. Nothing is stored server-side; the clipboard is the transport.
//
// Deliberately dependency-free and structurally typed rather than importing
// UIMessage from `ai`: these functions are pure and are unit-tested directly by
// evals/transcript.test.mjs under `node --test`, which shouldn't have to resolve
// the SDK's module graph to check string formatting.
//
// NO SITE COPY LIVES HERE. Every human-readable string in the output is either
// a field name from the roleFit tool schema, a label that already exists in the
// shell UI, or passed in by the caller. See CLAUDE.md.

export type TranscriptPart = {
  type: string;
  text?: string;
  state?: string;
  output?: unknown;
};

export type TranscriptMessage = {
  role: string;
  parts: TranscriptPart[];
};

type RoleFitOutput = {
  role?: string;
  rows?: {
    requirement?: string;
    verdict?: string;
    evidence?: string;
    downgrade?: string | null;
  }[];
  gaps?: string[];
  noGapsRationale?: string;
  verdict?: string;
};

type ProjectOutput = {
  title?: string;
  description?: string;
  role?: string;
  stack?: string[];
  caseStudyHref?: string;
};

type ResumeOutput = { htmlHref?: string; pdfHref?: string };

type ContactOutput = { email?: string; github?: string; linkedin?: string };

const SITE_ORIGIN = "https://sidhantmathur.com";

// Citation markers (Sprint 3). Kept as a local copy rather than an import from
// lib/verify.ts so this module stays free of the generated corpus — it is unit
// tested under `node --test` and has no business resolving a build artifact.
// The two regexes are asserted equivalent by evals/citations.test.mjs.
const CITATION_MARKER = /\[([a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*)\](?!\()/g;

/** Concatenated text of a message's text parts. */
export function textOf(message: TranscriptMessage): string {
  return message.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
}

/** Completed tool outputs on a message, in order. */
export function toolPartsOf(message: TranscriptMessage): TranscriptPart[] {
  return message.parts.filter(
    (p) =>
      typeof p.type === "string" &&
      p.type.startsWith("tool-") &&
      p.state === "output-available" &&
      p.output != null,
  );
}

/** Absolute URL, so a pasted transcript's links still work off-site. */
function absolute(href: string): string {
  return href.startsWith("/") ? `${SITE_ORIGIN}${href}` : href;
}

/**
 * Renders one tool output as markdown. Returns null for tools whose output adds
 * nothing in a text transcript.
 *
 * The roleFit case is the one that matters: it's the structured assessment a
 * recruiter would actually forward, and the caveats have to survive the trip.
 * If the model named a gap, it appears here.
 */
export function toolPartToMarkdown(part: TranscriptPart): string | null {
  const out = part.output;
  if (out == null || typeof out !== "object") return null;

  switch (part.type) {
    case "tool-roleFit": {
      const data = out as RoleFitOutput;
      const lines: string[] = [];
      // "Role fit — {role}" is the existing citation-chip label in app-shell.
      lines.push(data.role ? `**Role fit — ${data.role}**` : "**Role fit**");

      // The verdict tags travel. A forwarded assessment that dropped them
      // would read as a list of things he does, which is the flattering half
      // of what the panel showed — the same soft-pedal the schema exists to
      // prevent, arriving by way of the clipboard.
      const rows = Array.isArray(data.rows) ? data.rows : [];
      if (rows.length) {
        lines.push("");
        for (const row of rows) {
          if (!row?.requirement) continue;
          const evidence = (row.evidence ?? "").replace(CITATION_MARKER, "").trim();
          const verdict = row.verdict ?? "unclear";
          lines.push(`- **${verdict}** — ${row.requirement}${evidence ? ` — ${evidence}` : ""}`);
        }
      }

      const gaps = Array.isArray(data.gaps) ? data.gaps.filter(Boolean) : [];
      if (gaps.length) {
        lines.push("");
        // The label the panel renders over this field, not the schema's name.
        lines.push("What he doesn't have:");
        for (const gap of gaps) lines.push(`- ${gap.replace(CITATION_MARKER, "").trim()}`);
      } else if (data.noGapsRationale) {
        lines.push("", data.noGapsRationale.replace(CITATION_MARKER, "").trim());
      }

      if (data.verdict) {
        lines.push("", data.verdict.replace(CITATION_MARKER, "").trim());
      }
      return lines.join("\n");
    }

    case "tool-showProject": {
      const p = out as ProjectOutput;
      if (!p.title) return null;
      const lines = [`**${p.title}**`];
      if (p.description) lines.push("", p.description);
      if (p.stack?.length) lines.push("", `Stack: ${p.stack.join(", ")}`);
      if (p.caseStudyHref) lines.push("", absolute(p.caseStudyHref));
      return lines.join("\n");
    }

    case "tool-showResume": {
      const r = out as ResumeOutput;
      const hrefs = [r.htmlHref, r.pdfHref].filter(Boolean) as string[];
      if (!hrefs.length) return null;
      return hrefs.map((h) => absolute(h)).join("\n");
    }

    case "tool-contactCard": {
      const c = out as ContactOutput;
      const entries = [c.email, c.linkedin, c.github].filter(Boolean) as string[];
      if (!entries.length) return null;
      return entries.map((e) => e.replace(/^mailto:/, "")).join("\n");
    }

    default:
      return null;
  }
}

/**
 * One message as markdown. User turns become blockquotes, assistant turns stay
 * as plain prose — the model already writes in the markdown subset the site
 * renders, so its text passes through untouched.
 */
export function messageToMarkdown(message: TranscriptMessage): string {
  const text = textOf(message).trim();

  if (message.role === "user") {
    if (!text) return "";
    return text
      .split("\n")
      .map((line) => (line ? `> ${line}` : ">"))
      .join("\n");
  }

  // Inline markers are noise in a pasted email, but dropping the provenance
  // entirely would make a forwarded answer less checkable than the one on
  // screen. So they come out of the prose and the ids they named are listed
  // once at the end. (#17 in Sprint 5 owns what a real exported artifact looks
  // like; this is the minimum that doesn't lose information.)
  const cited: string[] = [];
  for (const [, id] of text.matchAll(CITATION_MARKER)) {
    if (!cited.includes(id)) cited.push(id);
  }
  const prose = text
    .replace(CITATION_MARKER, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "")
    .trim();

  const blocks: string[] = [];
  if (prose) blocks.push(prose);
  for (const part of toolPartsOf(message)) {
    const rendered = toolPartToMarkdown(part);
    if (rendered) blocks.push(rendered);
  }
  // "Sources" is a label, not site copy — the ids themselves are generated
  // identifiers from content/knowledge, the same ones shown beside the answer.
  if (cited.length) blocks.push(`Sources: ${cited.join(", ")}`);
  return blocks.join("\n\n");
}

export type TranscriptOptions = {
  /** Document title. Caller supplies it so no site copy lives in this module. */
  title?: string;
  /** Trailing note — the shell passes the disclaimer from docs/site-copy.md. */
  footer?: string;
  /** Canonical URL for the site, included under the title when a title is set. */
  sourceUrl?: string;
};

/**
 * A whole conversation as a markdown document.
 *
 * Empty messages are skipped: a turn that produced neither text nor a completed
 * tool output would otherwise leave a stray blockquote or a blank gap.
 */
export function conversationToMarkdown(
  messages: TranscriptMessage[],
  options: TranscriptOptions = {},
): string {
  const blocks: string[] = [];

  if (options.title) {
    blocks.push(`# ${options.title}`);
    if (options.sourceUrl) blocks.push(options.sourceUrl);
  }

  for (const message of messages) {
    const rendered = messageToMarkdown(message);
    if (rendered.trim()) blocks.push(rendered);
  }

  if (options.footer) {
    blocks.push("---", options.footer);
  }

  return blocks.join("\n\n") + "\n";
}
