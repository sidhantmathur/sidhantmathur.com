// Where an assistant answer breaks into blocks — the one place that decides.
//
// The citation gutter is indexed BY BLOCK. `lib/verify.ts` computes a block
// index for every claim it downgrades, and `components/shell/markdown.tsx`
// renders the margin note for block N beside the Nth thing it drew. If the two
// disagree about where block 3 starts, the mark lands on the wrong paragraph —
// silently, because both sides still produce a well-formed answer. Nothing on
// screen says the note moved.
//
// Both of them used to split the answer themselves, on the same regex, with the
// agreement written down in prose in both files and enforced by nothing. This
// module is that split, once, and `evals/answer-blocks.test.mjs` asserts the
// invariant directly: same block count, same block N, on both sides.
//
// Deliberately framework-free and dependency-free — no React, no generated
// corpus — so `node --test --experimental-strip-types` can import the real
// thing rather than a copy of it. Same reasoning as lib/verify.ts, which is a
// consumer and must stay dependency-free itself.

/**
 * An opening or closing code fence, alone on its line.
 *
 * Any fence line toggles the state, including a closing one that carries an
 * info string. CommonMark is stricter — a closer takes no info string and has
 * to match its opener's character and length — but the model is asked for a
 * five-construct subset, and a stricter rule here would mean a malformed fence
 * swallowing the rest of the answer instead of ending it.
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
 * Blank lines separate blocks. A fence is NOT exempt from that: a fenced block
 * containing a blank line spans two indices, and both consumers have to see it
 * that way. The renderer joins the halves for display while reporting the first
 * half's index; the checker sees two blocks with nothing checkable in either.
 * What matters is that they count the same.
 *
 * The fence state carries across blocks — the blank line that separated them
 * was consumed by the split, but it did not close anything.
 *
 * Runs on every streamed token (see components/shell/answer.tsx), so it is one
 * pass over the lines and nothing else. An unterminated fence is the normal
 * case mid-stream, not an error: its lines are `code` and the block ends.
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
 * The block as the citation checker should read it: fenced-code lines blanked.
 *
 * Code is not prose and a line of it is not a claim. Without this, an answer
 * that shows a snippet gets one "uncited" verdict per line of it — the check
 * asking which chunk of the resume supports `const rate = 0;`, which is both
 * wrong and the fastest way to teach a reader to stop reading the margin.
 *
 * Each masked line becomes a single SPACE rather than an empty string, and that
 * is the whole reason this lives next to the split instead of inside verify.ts.
 * Blocks are separated by blank lines. An emptied code line would read as a
 * blank one, split a block in two on the checker's side only, and shift every
 * later block's index by one — moving citations onto the wrong paragraph. A
 * space is non-blank, so masking preserves exactly which lines are empty, so it
 * cannot move a boundary. Blank lines already inside a fence stay blank: they
 * split on both sides, which is agreement, not a bug.
 *
 * Kept separate from `splitBlocks` rather than precomputed as a field on the
 * block, because the renderer never wants it and the split runs per keystroke.
 */
export function maskedText(block: AnswerBlock): string {
  return block.lines
    .map((line) => (line.kind === "prose" ? line.text : line.text.trim() ? " " : line.text))
    .join("\n");
}
