// Serializes a conversation to the shapes it can leave the page in.
//
// This is the storage-free answer to "can I keep this?" — a recruiter who has a
// useful conversation can paste it into an email, a Slack thread, or an ATS
// note. Nothing is stored server-side; the clipboard, the printer and the URL
// fragment are the transports.
//
// Sprint 5 EXTENDED this module rather than replacing it (roadmap #17): the
// markdown serializer below is unchanged, and the three new shapes — the
// snapshot the permalink compresses, the scorecard, and the condensed mail body
// — are more pure functions in the same lane. Compression and clipboard access
// live in lib/permalink.ts and the components; nothing here touches a browser
// API, which is what keeps the whole file runnable under `node --test`.
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

type RoleFitRow = {
  requirement?: string;
  verdict?: string;
  evidence?: string;
  downgrade?: string | null;
  /** Chunk ids the row cited and that exist (Sprint 4's reconciler fills these). */
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

// ---------------------------------------------------------------------------
// The snapshot — what a permalink carries (Sprint 5, #18)
// ---------------------------------------------------------------------------
//
// The URL fragment is the storage, so the wire format is chosen for size and
// for nothing else: one-letter keys, no ids, no timestamps per message, and
// only the parts that render. It is deliberately NOT the SDK's UIMessage shape
// — that carries streaming state, tool call ids and input echoes that would
// double the byte count for a reader who will never see them.
//
// Everything in a snapshot was already on the reader's screen. There is no
// server round-trip and nothing here is trusted on the way back in: the decoder
// caps every length and drops anything it doesn't recognise, because a snapshot
// arrives from whoever pasted the link.

export const SNAPSHOT_VERSION = 1;

export type SnapshotTool = { y: string; o: unknown };
export type SnapshotMessage = { r: "u" | "a"; t?: string; p?: SnapshotTool[] };
export type TranscriptSnapshot = { v: number; m: SnapshotMessage[] };

// Bounds on the way back in. The route caps a conversation at 10 user turns and
// a user message at 4,000 characters; these sit just above that, so a snapshot
// of the largest conversation the site can produce round-trips exactly while a
// hand-written fragment cannot make the page render a novel.
const MAX_SNAPSHOT_MESSAGES = 40;
const MAX_SNAPSHOT_TEXT = 8000;
const MAX_SNAPSHOT_TOOLS = 4;

/** A conversation reduced to what a permalink needs to replay it. */
export function toSnapshot(messages: TranscriptMessage[]): TranscriptSnapshot {
  const m: SnapshotMessage[] = [];
  for (const message of messages.slice(-MAX_SNAPSHOT_MESSAGES)) {
    const role = message.role === "user" ? "u" : "a";
    const text = textOf(message).slice(0, MAX_SNAPSHOT_TEXT);
    const tools = toolPartsOf(message)
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
 * The other direction, hardened.
 *
 * Returns an empty array rather than throwing on anything malformed: a bad
 * fragment is a link someone mangled in an email client, and the honest
 * response to that is the site's ordinary empty state, not an error screen.
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
        // Only tool names this module knows how to render survive the trip. An
        // unknown one would ride into the shell as a part nothing draws.
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

// ---------------------------------------------------------------------------
// The scorecard (Sprint 5, #24 — bank §6 Stage 3's output contract)
// ---------------------------------------------------------------------------
//
// Headline verdict, the counts, the strongest cited rows, EVERY gap, and the
// one recommendation line the model wrote. Nothing in here is composed by this
// module: every sentence is the model's, every requirement is the posting's,
// and the counts are counts of rows. The one editorial act is choosing which
// three evidence rows to show, and that ordering is stated below.
//
// "Not a chat transcript — a recruiter's reputation is attached when they hit
// send," which is why the gaps are the one section that is never truncated.

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

/** The rows worth showing first: a judged, cited, unflagged claim beats one without. */
function evidenceRank(row: RoleFitRow): number {
  const verdict = row.verdict ?? "unclear";
  let score = verdict === "met" ? 0 : verdict === "partial" ? 1 : 4;
  if (!(row.sources?.length)) score += 2;
  if (row.unverified?.length) score += 1;
  return score;
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
  const strongest = [...rows]
    .map((row, i) => ({ row, i }))
    .sort((a, b) => evidenceRank(a.row) - evidenceRank(b.row) || a.i - b.i)
    .slice(0, MAX_SCORECARD_EVIDENCE)
    .filter(({ row }) => row.evidence || row.sources?.length);
  if (strongest.length) {
    const lines: string[] = [];
    if (labels.evidence) lines.push(`**${labels.evidence}**`, "");
    for (const { row } of strongest) {
      const evidence = row.evidence ? ` — ${stripMarkers(row.evidence)}` : "";
      // The cited ids travel with the sentence. A forwarded claim that dropped
      // them is less checkable than the one on screen, which is the one thing
      // an exported artifact is not allowed to be.
      const sources = row.sources?.length ? ` [${row.sources.join(", ")}]` : "";
      lines.push(`- **${row.verdict ?? "unclear"}** — ${row.requirement}${evidence}${sources}`);
    }
    blocks.push(lines.join("\n"));
  }

  // Every gap, always, uncut. This is the section the export exists to protect.
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

// ---------------------------------------------------------------------------
// The mail draft (Sprint 5, bank §6 Stage 3's mailto)
// ---------------------------------------------------------------------------
//
// `mailto:` bodies are the one export path with a hard external ceiling —
// clients start truncating somewhere around 2,000 characters of encoded URL,
// and a truncated assessment is one whose gaps fell off the end. So the body is
// condensed on purpose and cut at a line boundary, and the permalink goes
// FIRST in the trailer so the full version is reachable even from a draft that
// a client decided to shorten.

export const MAILTO_MAX_BODY = 1600;

/** Cuts to `max` characters at the last line break, never mid-sentence. */
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
