import { Fragment, type ReactNode } from "react";

// A deliberately small markdown renderer for assistant turns.
//
// The model emits markdown; rendering it as plain text left literal `**bold**`
// on screen. react-markdown would be a dependency (and a parser, and a
// sanitizer) for a surface that only ever needs five constructs, so this
// handles exactly the subset the system prompt permits:
//
//   paragraphs · `- ` and `1. ` lists · **bold** · *italic* / _italic_
//   · `code` · [text](url)
//
// Anything else falls through as literal text, which is the correct failure
// mode: an unrendered character is a visible bug we can fix, whereas silently
// dropping content is not. No raw HTML is ever interpreted — output is built as
// React elements, so there is no injection surface.

const INLINE =
  /(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\s]+\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;

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
            className="text-text underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
          >
            {label}
          </a>
        ) : (
          <Fragment key={key}>{label}</Fragment>
        ),
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

export function Markdown({
  text,
  gutter,
}: {
  text: string;
  /**
   * Optional marginalia (#12): whatever this returns is rendered beside the
   * block, in a column that only exists at lg. Blocks are indexed by their
   * position in the same split the citation checker uses, so the two agree on
   * what "block 2" means.
   */
  gutter?: (blockIndex: number) => ReactNode;
}) {
  // Blank lines separate blocks. Streaming means this runs on partial text, so
  // every branch has to tolerate an unterminated block.
  const blocks = text.split(/\n{2,}/);

  // The margin is a grid column rather than an absolutely-positioned overlay so
  // a long note pushes its own row taller instead of colliding with the next.
  const wrap = (bi: number, node: ReactNode) =>
    gutter ? (
      <div key={bi} className="lg:grid lg:grid-cols-[1fr_6.5rem] lg:gap-4">
        <div className="min-w-0">{node}</div>
        <div className="hidden lg:block">{gutter(bi)}</div>
      </div>
    ) : (
      <Fragment key={bi}>{node}</Fragment>
    );

  return (
    <div className="space-y-3 text-[13px] leading-[1.7] text-text-soft">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;

        const bulleted = lines.every((l) => BULLET.test(l));
        const numbered = lines.every((l) => ORDERED.test(l));

        if (bulleted || numbered) {
          const Tag = numbered ? "ol" : "ul";
          return wrap(
            bi,
            <Tag
              className={`space-y-1.5 pl-4 ${numbered ? "list-decimal" : "list-disc"} marker:text-text-faint`}
            >
              {lines.map((l, li) => (
                <li key={li} className="pl-1">
                  {inline(l.replace(numbered ? ORDERED : BULLET, ""), `${bi}-${li}`)}
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
            <p className="font-medium text-text">
              {inline(lines[0].replace(/^#{1,6}\s+/, ""), `${bi}-h`)}
            </p>,
          );
        }

        return wrap(
          bi,
          <p className="whitespace-pre-wrap">{inline(lines.join("\n"), String(bi))}</p>,
        );
      })}
    </div>
  );
}
