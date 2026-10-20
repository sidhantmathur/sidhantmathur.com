// Serializes a conversation to the shapes it can leave the page in: a markdown
// transcript, the snapshot a permalink carries, an interview-style scorecard
// for a fit check, and a condensed mail draft. Nothing is stored server-side;
// the clipboard, the printer and the URL fragment are the transports.
//
// No site copy lives here. Every human-readable string in the output is a field
// name from the roleFit tool schema, a label the shell already shows, or passed
// in by the caller. The one import, JD_PREFIX, is the request the paste panel
// already sends, owned by lib/job-posting.ts, which imports nothing.
//
// Pure functions only. Compression and clipboard access live in
// lib/permalink.ts and the components, and messages are typed structurally
// rather than as the SDK's UIMessage, so evals/transcript.test.mjs can run this
// under `node --test` without resolving the SDK.

import { JD_PREFIX } from "./job-posting.ts";

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

type RoleFitRow = {
  requirement?: string;
  verdict?: string;
  evidence?: string;
  downgrade?: string | null;
  /** Chunk ids the row cited and that exist (filled by lib/role-fit.ts). */
  sources?: string[];
  /** Checkable tokens the cited chunks didn't contain. */
  unverified?: string[];
};

type RoleFitOutput = {
  role?: string;
  rows?: RoleFitRow[];
  counts?: Record<string, number>;
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

// A local copy of lib/verify.ts's citation marker, so this module imports
// nothing beyond lib/job-posting.ts. evals/citations.test.mjs asserts the two
// strip the same way.
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
 * nothing in a text transcript. For roleFit, the verdict tags and every gap
 * survive the trip.
 */
export function toolPartToMarkdown(part: TranscriptPart): string | null {
  const out = part.output;
  if (out == null || typeof out !== "object") return null;

  switch (part.type) {
    case "tool-roleFit": {
      const data = out as RoleFitOutput;
      const lines: string[] = [];
      // "Role fit — {role}" is the shell's existing chip label.
      lines.push(data.role ? `**Role fit — ${data.role}**` : "**Role fit**");

      // The verdict tags travel: without them a forwarded assessment reads as
      // a list of things he does, the flattering half of what the panel showed.
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
  // would make a forwarded answer less checkable than the one on screen. So
  // they come out of the prose and the ids are listed once at the end.
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
  // "Sources" is a label, not site copy; the ids are the same chunk ids shown
  // beside the answer.
  if (cited.length) blocks.push(`Sources: ${cited.join(", ")}`);
  return blocks.join("\n\n");
}

export type TranscriptOptions = {
  /** Document title. Caller supplies it so no site copy lives in this module. */
  title?: string;
  /** Trailing note. The shell passes DISCLAIMER from lib/site.ts. */
  footer?: string;
  /** Canonical URL for the site, included under the title when a title is set. */
  sourceUrl?: string;
  /**
   * A permalink to this conversation, printed under the source URL. Optional
   * because generating one is async and can be declined; the markdown is the
   * same document with or without it.
   */
  permalink?: string;
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
    const head = [options.sourceUrl, options.permalink].filter(Boolean) as string[];
    if (head.length) blocks.push(head.join("\n"));
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

// --- The snapshot: what a permalink carries -------------------------------
//
// The URL fragment is the storage, so the format is chosen for size: one-letter
// keys, no ids or timestamps, and only the parts that render. Not the SDK's
// UIMessage shape, whose streaming state, tool call ids and input echoes would
// double the byte count. Nothing is trusted on the way back in: a snapshot
// arrives from whoever pasted the link, so the decoder caps every length and
// drops anything it doesn't recognise.

export const SNAPSHOT_VERSION = 1;

export type SnapshotTool = { y: string; o: unknown };
export type SnapshotMessage = { r: "u" | "a"; t?: string; p?: SnapshotTool[] };
export type TranscriptSnapshot = { v: number; m: SnapshotMessage[] };

// Bounds on the way back in. They sit above the route's caps (MAX_USER_MESSAGES
// and MAX_USER_TEXT), so the largest conversation the site can produce
// round-trips exactly while a hand-written fragment can't make the page render
// a novel.
const MAX_SNAPSHOT_MESSAGES = 40;
const MAX_SNAPSHOT_TEXT = 8000;
const MAX_SNAPSHOT_TOOLS = 4;

/**
 * Tool parts that never render. A local copy of lib/chat-transport.ts's
 * INTERNAL_TOOLS, so this module stays free of the transport's imports.
 * evals/export.test.mjs asserts the two agree.
 */
export const INTERNAL_TOOL_PARTS: ReadonlySet<string> = new Set(["tool-extractRequirements"]);

/**
 * A user turn the route treated as a pasted posting: the reply carries the
 * extraction step, which the route forces on posting turns only. Reading the
 * reply rather than re-running the heuristic means a short question that
 * produced a `roleFit` ("is he a fit for an SE role?") is never blanked.
 */
function isPostingTurn(message: TranscriptMessage, next: TranscriptMessage | undefined): boolean {
  if (message.role !== "user" || next?.role !== "assistant") return false;
  return next.parts.some((p) => p.type === "tool-extractRequirements");
}

/**
 * A conversation reduced to what a permalink needs to replay it. Two things
 * never travel (sizes in docs/application-links.md):
 *
 *   - The posting. The reader a fit check is sent to already has it, and the
 *     table quotes every requirement it judged. The turn replays as the paste
 *     panel's request line, and the replay banner says the posting was left
 *     out.
 *   - `extractRequirements`. Internal (lib/chat-transport.ts): it never
 *     renders, and every line of it reappears as a row of the table.
 *
 * The full table can still exceed what mail clients and ATS fields keep; that
 * is what `fitSnapshot` is for.
 */
export function toSnapshot(messages: TranscriptMessage[]): TranscriptSnapshot {
  const m: SnapshotMessage[] = [];
  const kept = messages.slice(-MAX_SNAPSHOT_MESSAGES);
  for (const [i, message] of kept.entries()) {
    const role = message.role === "user" ? "u" : "a";
    // A posting replays as the paste panel's request line, whether or not this
    // turn came through the panel.
    const text = isPostingTurn(message, kept[i + 1])
      ? JD_PREFIX
      : textOf(message).slice(0, MAX_SNAPSHOT_TEXT);
    const tools = toolPartsOf(message)
      .filter((p) => !INTERNAL_TOOL_PARTS.has(p.type))
      .slice(0, MAX_SNAPSHOT_TOOLS)
      .map((p) => ({ y: p.type, o: p.output }));
    if (!text && !tools.length) continue;
    const entry: SnapshotMessage = { r: role };
    if (text) entry.t = text;
    if (tools.length) entry.p = tools;
    m.push(entry);
  }
  return { v: SNAPSHOT_VERSION, m };
}

/**
 * The other direction, hardened. Returns an empty array rather than throwing on
 * anything malformed: a bad fragment is usually a link mangled by an email
 * client, and gets the ordinary empty state, not an error screen.
 */
export function fromSnapshot(value: unknown): TranscriptMessage[] {
  if (!value || typeof value !== "object") return [];
  const snap = value as Partial<TranscriptSnapshot>;
  if (snap.v !== SNAPSHOT_VERSION || !Array.isArray(snap.m)) return [];

  const out: TranscriptMessage[] = [];
  for (const raw of snap.m.slice(0, MAX_SNAPSHOT_MESSAGES)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as SnapshotMessage;
    const role = entry.r === "u" ? "user" : entry.r === "a" ? "assistant" : null;
    if (!role) continue;

    const parts: TranscriptPart[] = [];
    if (typeof entry.t === "string" && entry.t) {
      parts.push({ type: "text", text: entry.t.slice(0, MAX_SNAPSHOT_TEXT) });
    }
    if (Array.isArray(entry.p)) {
      for (const tool of entry.p.slice(0, MAX_SNAPSHOT_TOOLS)) {
        if (!tool || typeof tool !== "object") continue;
        const { y, o } = tool as SnapshotTool;
        if (typeof y !== "string" || !y.startsWith("tool-")) continue;
        if (o == null || typeof o !== "object") continue;
        parts.push({ type: y, state: "output-available", output: o });
      }
    }
    if (!parts.length) continue;
    out.push({ role, parts });
  }
  return out;
}

// --- The scorecard --------------------------------------------------------
//
// The model's verdict line, the counts, the strongest cited rows and every gap.
// Nothing here is composed by this module: every sentence is the model's, every
// requirement is the posting's, and the counts are counts of rows. The one
// editorial act is choosing which three evidence rows to show (`evidenceRank`).
// The gaps are never truncated: whoever forwards this puts their name on it.

const MAX_SCORECARD_EVIDENCE = 3;

export type ScorecardOptions = {
  /** Document title. Supplied by the caller, like every other label here. */
  title?: string;
  sourceUrl?: string;
  permalink?: string;
  footer?: string;
  /** Section labels, passed in so no site copy lives in this module. */
  labels?: {
    counts?: string;
    evidence?: string;
    gaps?: string;
    noGaps?: string;
  };
};

/**
 * The rows worth showing first: a judged, cited, unflagged claim beats one
 * without. Only cited rows are eligible (see `strongestRows`): a row with
 * nothing to point at is not evidence.
 */
function evidenceRank(row: RoleFitRow): number {
  const verdict = row.verdict ?? "unclear";
  let score = verdict === "met" ? 0 : verdict === "partial" ? 1 : 4;
  if (!(row.sources?.length)) score += 2;
  if (row.unverified?.length) score += 1;
  return score;
}

/** The scorecard's evidence rows, strongest first, with their table positions. */
function strongestRows(rows: RoleFitRow[]): { row: RoleFitRow; i: number }[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => evidenceRank(a.row) - evidenceRank(b.row) || a.i - b.i)
    .filter(({ row }) => row.sources?.length && row.evidence)
    .slice(0, MAX_SCORECARD_EVIDENCE);
}

/** Counts rendered as `6 met · 3 partial · 2 unmet` — a count, never a score. */
export function verdictCounts(fit: RoleFitOutput): string {
  const order = ["met", "partial", "unmet", "unclear"];
  const counts: Record<string, number> = {};
  if (fit.counts && typeof fit.counts === "object") {
    for (const [k, v] of Object.entries(fit.counts)) {
      if (typeof v === "number") counts[k] = v;
    }
  } else {
    for (const row of fit.rows ?? []) {
      const v = row?.verdict ?? "unclear";
      counts[v] = (counts[v] ?? 0) + 1;
    }
  }
  return order
    .filter((v) => (counts[v] ?? 0) > 0)
    .map((v) => `${counts[v]} ${v}`)
    .join(" · ");
}

/** The assessment in interview-scorecard shape. */
export function scorecardMarkdown(
  fit: RoleFitOutput,
  options: ScorecardOptions = {},
): string {
  const labels = options.labels ?? {};
  const blocks: string[] = [];

  const heading = [options.title, fit.role].filter(Boolean).join(" — ");
  if (heading) blocks.push(`# ${heading}`);
  const head = [options.sourceUrl, options.permalink].filter(Boolean) as string[];
  if (head.length) blocks.push(head.join("\n"));

  if (fit.verdict) blocks.push(stripMarkers(fit.verdict));

  const counts = verdictCounts(fit);
  if (counts) blocks.push(labels.counts ? `${labels.counts}: ${counts}` : counts);

  const rows = (fit.rows ?? []).filter((r) => r?.requirement);
  const strongest = strongestRows(rows);
  if (strongest.length) {
    const lines: string[] = [];
    if (labels.evidence) lines.push(`**${labels.evidence}**`, "");
    for (const { row } of strongest) {
      const evidence = row.evidence ? ` — ${stripMarkers(row.evidence)}` : "";
      // The cited ids travel with the sentence, so the forwarded claim stays
      // as checkable as the one on screen.
      const sources = row.sources?.length ? ` [${row.sources.join(", ")}]` : "";
      lines.push(`- **${row.verdict ?? "unclear"}** — ${row.requirement}${evidence}${sources}`);
    }
    blocks.push(lines.join("\n"));
  }

  // Every gap, always, uncut.
  const gaps = (fit.gaps ?? []).filter(Boolean);
  if (gaps.length) {
    const lines: string[] = [];
    if (labels.gaps) lines.push(`**${labels.gaps}**`, "");
    for (const gap of gaps) lines.push(`- ${stripMarkers(gap)}`);
    blocks.push(lines.join("\n"));
  } else if (fit.noGapsRationale) {
    const lines: string[] = [];
    if (labels.noGaps) lines.push(`**${labels.noGaps}**`, "");
    lines.push(stripMarkers(fit.noGapsRationale));
    blocks.push(lines.join("\n"));
  }

  if (options.footer) blocks.push("---", options.footer);
  return blocks.join("\n\n") + "\n";
}

/** The last completed roleFit output in a conversation, if there is one. */
export function latestRoleFit(messages: TranscriptMessage[]): RoleFitOutput | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    for (const part of toolPartsOf(messages[i]!)) {
      if (part.type === "tool-roleFit" && part.output && typeof part.output === "object") {
        return part.output as RoleFitOutput;
      }
    }
  }
  return null;
}

// --- The short fit link (docs/application-links.md) -----------------------
//
// A whole fit-check table doesn't fit in a link that survives an ATS field or a
// plain-text email. The short link carries what the scorecard keeps (the
// verdict, the counts, the strongest cited rows and every gap) plus the
// answer's prose, as a snapshot.

/**
 * The latest fit check as a short permalink's snapshot, or null if there is
 * none. The rows are the scorecard's, back in the posting's order. The counts
 * stay the whole table's: that is how the replayed table knows it is an excerpt
 * and says so (`fitExcerptNote`).
 */
export function fitSnapshot(messages: TranscriptMessage[]): TranscriptSnapshot | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.role !== "assistant") continue;
    const part = toolPartsOf(message).find((p) => p.type === "tool-roleFit");
    if (!part || typeof part.output !== "object") continue;

    const fit = part.output as RoleFitOutput;
    const rows = (Array.isArray(fit.rows) ? fit.rows : []).filter((r) => r?.requirement);
    const counts: Record<string, number> = {};
    if (fit.counts && typeof fit.counts === "object") Object.assign(counts, fit.counts);
    else for (const row of rows) counts[row.verdict ?? "unclear"] = (counts[row.verdict ?? "unclear"] ?? 0) + 1;
    const excerpt = {
      ...fit,
      rows: strongestRows(rows)
        .sort((a, b) => a.i - b.i)
        .map(({ row }) => row),
      counts,
      gaps: Array.isArray(fit.gaps) ? fit.gaps : [],
    };

    // The request that produced it: the paste panel's line for a posting, or
    // the question itself.
    const prev = messages[i - 1];
    const ask = prev?.role === "user" ? (isPostingTurn(prev, message) ? JD_PREFIX : textOf(prev)) : "";
    const answer: SnapshotMessage = { r: "a", p: [{ y: part.type, o: excerpt }] };
    const prose = textOf(message).slice(0, MAX_SNAPSHOT_TEXT);
    if (prose) answer.t = prose;
    const m: SnapshotMessage[] = [];
    if (ask) m.push({ r: "u", t: ask.slice(0, MAX_SNAPSHOT_TEXT) });
    m.push(answer);
    return { v: SNAPSHOT_VERSION, m };
  }
  return null;
}

// --- The mail draft -------------------------------------------------------
//
// `mailto:` bodies have a hard external ceiling: clients start truncating
// around 2,000 characters of encoded URL, and a truncated assessment is one
// whose gaps fell off the end. So the body is condensed and cut at a line
// boundary. scorecardMarkdown puts the permalink at the top, under the heading,
// so the full version is reachable even from a draft a client shortened.

export const MAILTO_MAX_BODY = 1600;

/**
 * Cuts to `max` characters at the last line break, or mid-line when no break
 * falls in the second half.
 */
export function condense(body: string, max = MAILTO_MAX_BODY): string {
  if (body.length <= max) return body;
  const cut = body.slice(0, max);
  const boundary = cut.lastIndexOf("\n");
  return (boundary > max * 0.5 ? cut.slice(0, boundary) : cut).trimEnd();
}

/**
 * A `mailto:` URL with the body already condensed.
 *
 * Markdown emphasis is stripped: a mail body is plain text, and `**met**` in a
 * Gmail compose window reads as a typo rather than as a tag.
 */
export function mailtoHref({
  to = "",
  subject,
  body,
  max = MAILTO_MAX_BODY,
}: {
  to?: string;
  subject: string;
  body: string;
  max?: number;
}): string {
  const plain = condense(body.replace(/\*\*/g, ""), max);
  const query = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plain)}`;
  return `mailto:${to}?${query}`;
}

/** Drops citation markers from a string headed for a plain-text artifact. */
function stripMarkers(text: string): string {
  return text.replace(CITATION_MARKER, "").replace(/[ \t]{2,}/g, " ").trim();
}
