// Where an assistant answer breaks into blocks: the one place that decides.
//
// The citation gutter is indexed by block. `lib/verify.ts` computes a block
// index for every claim it downgrades, and `components/shell/markdown.tsx`
// renders the margin note for block N beside the Nth block it drew. If the two
// disagreed about where a block starts, the mark would land on the wrong
// paragraph with nothing on screen to show it. Both split with this module, and
// `evals/answer-blocks.test.mjs` asserts they agree.
//
// Framework- and dependency-free (no React, no generated corpus) so
// `node --test --experimental-strip-types` can import it, and so lib/verify.ts,
// a consumer, stays dependency-free too.

/**
 * An opening or closing code fence, alone on its line.
 *
 * Any fence line toggles the state, including a closer with an info string.
 * CommonMark is stricter (a closer takes no info string and must match its
 * opener's character and length), but the model is asked for a small markdown
 * subset, and the stricter rule would let a malformed fence swallow the rest of
 * the answer instead of ending it.
 */
const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;

/** Is this line a fence delimiter? For callers walking lines for other reasons. */
export function isFenceLine(line: string): boolean {
  return FENCE.test(line);
}

/**
 * One line of a block, classified by where the fence state machine was when it
 * arrived. `open` and `close` are the delimiter lines themselves; `code` is
 * what sits between them, including blank lines.
 */
export type BlockLine =
  | { kind: "prose"; text: string }
  | { kind: "open"; text: string; lang: string }
  | { kind: "code"; text: string }
  | { kind: "close"; text: string };

export type AnswerBlock = {
  /** Position in the answer. This is the number the gutter is keyed on. */
  index: number;
  /** The block exactly as the model wrote it. */
  text: string;
  lines: BlockLine[];
};

/**
 * Splits an answer into the blocks the gutter is indexed by.
 *
 * Blank lines separate blocks, inside a fence too: a fenced block containing a
 * blank line spans two indices on both sides. The renderer joins the halves for
 * display under the first half's index; the checker sees two blocks with
 * nothing checkable. The fence state carries across the split.
 *
 * Runs on every streamed token (components/shell/answer.tsx), so it is a single
 * pass. An unterminated fence is normal mid-stream: its lines are `code` and
 * the block ends.
 */
export function splitBlocks(answer: string): AnswerBlock[] {
  let open = false;

  return answer.split(/\n{2,}/).map((text, index) => ({
    index,
    text,
    lines: text.split("\n").map((line): BlockLine => {
      const fence = FENCE.exec(line);
      if (fence) {
        open = !open;
        return open ? { kind: "open", text: line, lang: fence[2] ?? "" } : { kind: "close", text: line };
      }
      return open ? { kind: "code", text: line } : { kind: "prose", text: line };
    }),
  }));
}

/**
 * The block as the citation checker should read it: fenced-code lines blanked,
 * since a line of code is not a claim.
 *
 * Each masked line becomes a single space, not an empty string, which is why
 * this lives beside the split rather than in verify.ts. An emptied line would
 * read as blank, split the block on the checker's side only, and shift every
 * later block's index by one. Blank lines already inside a fence stay blank;
 * they split on both sides.
 *
 * Not precomputed on the block, because the renderer never wants it and the
 * split runs on every streamed token.
 */
export function maskedText(block: AnswerBlock): string {
  return block.lines
    .map((line) => (line.kind === "prose" ? line.text : line.text.trim() ? " " : line.text))
    .join("\n");
}
