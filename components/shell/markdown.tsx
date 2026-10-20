import { Fragment, type ReactNode } from "react";

import { splitBlocks, type AnswerBlock } from "@/lib/answer-blocks";
import { downloadAs } from "@/lib/site";

// A small markdown renderer for assistant turns. It handles exactly the subset
// the system prompt permits, which is too little to justify react-markdown's
// parser and sanitizer:
//
//   paragraphs · `- ` and `1. ` lists · **bold** · *italic* / _italic_
//   · `code` · [text](url) · ```fenced``` blocks · | pipe | tables |
//
// Anything else falls through as literal text, which is the right failure: an
// unrendered character is a visible bug, silently dropped content isn't. No raw
// HTML is ever interpreted; output is built as React elements, so there is no
// injection surface.

// Bare site paths are linked even when the model writes them as plain text,
// because "download it at /resume.pdf" is otherwise an address to retype on a
// phone. An allowlist rather than a general /\S+ pattern, so "9/10 turns" or a
// stray slash never becomes a link.
const SITE_PATHS = [
  "/resume.pdf",
  "/resume",
  "/projects/adarle20",
  "/projects/dell-ml",
  "/projects/nokia",
  "/colophon",
];
// Longest first, so /resume.pdf wins over the /resume prefix. The trailing
// guard keeps /resume from matching inside /resumes.
const BARE_PATH = new RegExp(
  `(?<![\\w/(])(${SITE_PATHS.map((p) => p.replace(/[.]/g, "\\.")).join("|")})(?![\\w/])`,
);

const INLINE = new RegExp(
  [
    "(`[^`\\n]+`)",
    "(\\[[^\\]\\n]+\\]\\([^)\\s]+\\))",
    "(\\*\\*[^*\\n]+\\*\\*)",
    "(\\*[^*\\n]+\\*)",
    "(_[^_\\n]+_)",
    `(${BARE_PATH.source})`,
  ].join("|"),
  "g",
);

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith("`")) {
      out.push(
        <code key={key} className="bg-raised px-1 text-text">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      const label = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      // Only http(s), mailto and site-relative links render as links. Anything
      // else (javascript:, data:, …) degrades to its label text.
      const safe = /^(https?:|mailto:|\/)/i.test(href);
      out.push(
        safe ? (
          <a
            key={key}
            href={href}
            {...(href.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer" })}
            {...downloadAs(href)}
            className="text-text underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
          >
            {label}
          </a>
        ) : (
          <Fragment key={key}>{label}</Fragment>
        ),
      );
    } else if (token.startsWith("/")) {
      // A bare path the model wrote as prose. The label stays the path itself
      // rather than words the model didn't write.
      out.push(
        <a
          key={key}
          href={token}
          {...(token.endsWith(".pdf") ? { target: "_blank", rel: "noreferrer" } : {})}
          {...downloadAs(token)}
          className="text-text underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
        >
          {token}
        </a>,
      );
    } else if (token.startsWith("**")) {
      out.push(
        <strong key={key} className="font-medium text-text">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;

// ---------------------------------------------------------------------------
// Fenced code blocks
// ---------------------------------------------------------------------------
//
// The hard part is the block indices. `lib/verify.ts` indexes the citation
// gutter by the same blank-line split, which lives in `lib/answer-blocks.ts`
// along with each line's classification (prose, fence delimiter or code). A
// fence containing a blank line spans two blocks, so the renderer joins them
// for display while still reporting the original index to the gutter. Anything
// that renumbers blocks here slides every citation one paragraph up.
//
// While streaming, an unterminated fence renders as a code block rather than
// as literal backticks: `splitBlocks` leaves it open and the flush after the
// loop draws it.

type Group =
  | { kind: "prose"; index: number; block: string }
  | { kind: "code"; index: number; lang: string; code: string };

/**
 * Blank-line blocks → renderable groups, carrying the index each group came
 * from. Two groups can share an index (prose and a fence in one block); the
 * caller renders the gutter for the first of them only.
 */
function group(blocks: AnswerBlock[]): Group[] {
  const groups: Group[] = [];
  let open: { index: number; lang: string; lines: string[] } | null = null;

  blocks.forEach(({ index, lines }) => {
    let prose: string[] = [];
    const flush = () => {
      if (prose.some((l) => l.trim())) {
        groups.push({ kind: "prose", index, block: prose.join("\n") });
      }
      prose = [];
    };

    for (const line of lines) {
      if (line.kind === "open") {
        flush();
        open = { index, lang: line.lang, lines: [] };
      } else if (open && line.kind === "close") {
        groups.push({ kind: "code", index: open.index, lang: open.lang, code: open.lines.join("\n") });
        open = null;
      } else if (open) {
        open.lines.push(line.text);
      } else {
        prose.push(line.text);
      }
    }
    flush();
    // The blank line that separated this block from the next was consumed by
    // the split. Inside a fence it was part of the code.
    if (open) open.lines.push("");
  });

  if (open) {
    // Still streaming, or the model never closed it. Render what arrived.
    const o: { index: number; lang: string; lines: string[] } = open;
    groups.push({ kind: "code", index: o.index, lang: o.lang, code: o.lines.join("\n").trimEnd() });
  }
  return groups;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div className="border border-line bg-raised">
      {/* The language, when the model wrote one. No syntax highlighting: it
          would need a parser dependency and a second palette, and coloured
          tokens would be the loudest thing on the page. */}
      {lang && (
        <div className="border-b border-line px-3 py-1 t-label tracking-widest text-text-faint [font-family:var(--font-geist-mono)]">
          {lang.toLowerCase()}
        </div>
      )}
      {/* Scrolls itself, so a long line can't widen the answer column and put
          the whole page on a horizontal scrollbar. */}
      <pre className="overflow-x-auto px-3 py-2.5">
        <code className="t-meta text-text [font-family:var(--font-geist-mono)]">
          {code}
        </code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipe tables
// ---------------------------------------------------------------------------
//
// For tables the model writes into ordinary prose. The `roleFit` requirement
// table is a separate component in the panel.
const DELIMITER = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** A header row, a delimiter under it, and at least the start of a body. */
function isTable(lines: string[]): boolean {
  return (
    lines.length >= 2 &&
    lines[0]!.includes("|") &&
    DELIMITER.test(lines[1]!) &&
    lines[1]!.includes("|")
  );
}

function Table({ lines, keyPrefix }: { lines: string[]; keyPrefix: string }) {
  const head = cells(lines[0]!);
  // Rows only — the delimiter is punctuation, not data. Ragged rows are padded
  // rather than dropped: a table still streaming is short a cell for one frame,
  // and collapsing the row would make the whole table jump when it arrives.
  const body = lines.slice(2).map((l) => {
    const row = cells(l);
    while (row.length < head.length) row.push("");
    return row.slice(0, head.length);
  });

  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full border-collapse text-left t-meta">
        <thead>
          <tr className="border-b border-line">
            {head.map((c, i) => (
              <th
                key={i}
                className="px-3 py-2 font-normal tracking-widest text-text-faint [font-family:var(--font-geist-mono)] t-label align-top"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            // No zebra striping: the site has one raised surface and it means
            // "this is a container", not "this is an odd row".
            <tr key={ri} className="border-b border-line last:border-b-0">
              {row.map((c, ci) => (
                <td key={ci} className="px-3 py-2 align-top leading-[1.6] text-text-soft">
                  {inline(c, `${keyPrefix}-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Markdown({
  text,
  gutter,
  trailing,
}: {
  text: string;
  /**
   * Optional marginalia: whatever this returns is rendered beside the block, in
   * a column that only exists at lg. Blocks are indexed by their position in
   * the same split the citation checker uses, so the two agree on what
   * "block 2" means.
   */
  gutter?: (blockIndex: number) => ReactNode;
  /**
   * Rendered at the very end of the last block: the streaming caret.
   *
   * A prop rather than a `:last-child::after` rule, because the blocks render
   * as bare Fragments without a gutter and as grid rows with one. "The last
   * child" is a different element in the two cases, so a selector that worked
   * while streaming would stop working the moment the turn settled.
   */
  trailing?: ReactNode;
}) {
  // The same split lib/verify.ts uses. This runs on partial text while
  // streaming, so every branch has to tolerate an unterminated block.
  const groups = group(splitBlocks(text));

  // A block that produced both prose and a fence gets its margin note once,
  // against the first thing rendered from it.
  const seen = new Set<number>();

  // The margin is a grid column rather than an absolutely-positioned overlay so
  // a long note pushes its own row taller instead of colliding with the next.
  const wrap = (bi: number, key: string, node: ReactNode) => {
    const first = !seen.has(bi);
    seen.add(bi);
    return gutter ? (
      <div key={key} className="lg:grid lg:grid-cols-[1fr_6.5rem] lg:gap-4">
        <div className="min-w-0">{node}</div>
        <div className="hidden lg:block">{first ? gutter(bi) : null}</div>
      </div>
    ) : (
      <Fragment key={key}>{node}</Fragment>
    );
  };

  // The caret belongs inside the last paragraph, on the same line as the last
  // word. Only the paragraph and heading branches below can hold it; if the
  // answer currently ends in a list, a table or a fence, it gets a line of its
  // own after the map.
  //
  // Decided up front by running the same branch conditions against the last
  // group, rather than by setting a flag inside the map: a variable written
  // during one iteration and read after the loop is a pattern the React
  // compiler rejects.
  const lastGroup = groups[groups.length - 1];
  const trailingInline =
    trailing != null &&
    lastGroup != null &&
    lastGroup.kind === "prose" &&
    (() => {
      const lines = lastGroup.block.split("\n").filter((l) => l.trim() !== "");
      if (!lines.length) return false;
      if (isTable(lines)) return false;
      // A heading renders as a <p> too, so it is inline-capable and needs no
      // case of its own here.
      return !lines.every((l) => BULLET.test(l)) && !lines.every((l) => ORDERED.test(l));
    })();

  return (
    // The most-read text on the site, so body size rather than caption size:
    // `t-body` is 16px on a phone and 15px from 768px up.
    <div className="t-body space-y-3 text-text-soft">
      {groups.map((g, gi) => {
        const bi = g.index;
        const key = `${bi}-${gi}`;
        const last = trailingInline && gi === groups.length - 1;

        if (g.kind === "code") {
          return wrap(bi, key, <CodeBlock lang={g.lang} code={g.code} />);
        }

        const block = g.block;
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;

        if (isTable(lines)) {
          return wrap(bi, key, <Table lines={lines} keyPrefix={key} />);
        }

        const bulleted = lines.every((l) => BULLET.test(l));
        const numbered = lines.every((l) => ORDERED.test(l));

        if (bulleted || numbered) {
          const Tag = numbered ? "ol" : "ul";
          return wrap(
            bi,
            key,
            <Tag
              className={`space-y-1.5 pl-4 ${numbered ? "list-decimal" : "list-disc"} marker:text-text-faint`}
            >
              {lines.map((l, li) => (
                <li key={li} className="pl-1">
                  {inline(l.replace(numbered ? ORDERED : BULLET, ""), `${key}-${li}`)}
                </li>
              ))}
            </Tag>,
          );
        }

        // Headings would be too loud in a chat turn; render them as emphasis.
        const isHeading = /^#{1,6}\s+/.test(lines[0]) && lines.length === 1;
        if (isHeading) {
          return wrap(
            bi,
            key,
            <p className="font-medium text-text">
              {inline(lines[0].replace(/^#{1,6}\s+/, ""), `${key}-h`)}
              {last && trailing}
            </p>,
          );
        }

        return wrap(
          bi,
          key,
          <p className="whitespace-pre-wrap">
            {inline(lines.join("\n"), key)}
            {last && trailing}
          </p>,
        );
      })}
      {/* The answer ends in a fence, a table or a list — or hasn't produced a
          block yet, which is the first frame of every turn. */}
      {trailing != null && !trailingInline && <p>{trailing}</p>}
    </div>
  );
}
