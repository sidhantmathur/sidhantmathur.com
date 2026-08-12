// The block split — the contract between the citation checker and the renderer.
//
// `lib/verify.ts` attaches every claim to a block index and
// `components/shell/markdown.tsx` draws the margin note for block N beside the
// Nth thing it rendered. Until now both computed that index themselves, from
// the same regex, with the agreement written down in prose in both files and
// checked by nothing. When they disagreed the answer still rendered and the
// check still ran — the mark just sat on the wrong paragraph.
//
// So the assertions that matter here are the ones at the bottom: for a set of
// representative answers, the blocks the checker indexes ARE the blocks the
// renderer indexes. Everything above them is the behaviour of the one function
// that now decides.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { isFenceLine, maskedText, splitBlocks } from "../lib/answer-blocks.ts";

/** The blocks as the checker reads them: fenced code blanked. */
const masked = (answer) => splitBlocks(answer).map(maskedText);

/** The blocks as the renderer reads them, before it groups them. */
const raw = (answer) => splitBlocks(answer).map((b) => b.text);

const kinds = (answer) => splitBlocks(answer).flatMap((b) => b.lines.map((l) => l.kind));

describe("splitBlocks — paragraphs", () => {
  test("splits on a blank line", () => {
    const blocks = splitBlocks("First paragraph.\n\nSecond paragraph.");
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].text, "First paragraph.");
    assert.equal(blocks[1].text, "Second paragraph.");
    assert.deepEqual(
      blocks.map((b) => b.index),
      [0, 1],
    );
  });

  test("a soft-wrapped paragraph is one block", () => {
    const blocks = splitBlocks("He shipped it.\nThen he measured it.");
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].lines.length, 2);
  });

  test("two or more blank lines behave exactly like one", () => {
    const one = splitBlocks("A.\n\nB.\n\nC.");
    for (const gap of ["\n\n\n", "\n\n\n\n", "\n\n\n\n\n\n"]) {
      const many = splitBlocks(`A.${gap}B.${gap}C.`);
      assert.deepEqual(
        many.map((b) => b.text),
        one.map((b) => b.text),
        `gap of ${gap.length} newlines`,
      );
    }
  });

  test("an index is a position, contiguous from zero", () => {
    const blocks = splitBlocks("A.\n\nB.\n\nC.\n\nD.");
    assert.deepEqual(
      blocks.map((b) => b.index),
      [0, 1, 2, 3],
    );
  });

  test("prose is untouched by the mask", () => {
    const answer = "He led the rollout [resume:nokia].\n\n- One\n- Two";
    assert.deepEqual(masked(answer), raw(answer));
  });
});

describe("splitBlocks — fences", () => {
  const SIMPLE = "Here is the shape:\n\n```ts\nconst rate = 0;\n```\n\nThat is all.";

  test("a fence with no blank line inside it is one block", () => {
    const blocks = splitBlocks(SIMPLE);
    assert.equal(blocks.length, 3);
    assert.deepEqual(
      blocks[1].lines.map((l) => l.kind),
      ["open", "code", "close"],
    );
    assert.equal(blocks[1].lines[0].lang, "ts");
  });

  test("the mask blanks the fence and its contents, and nothing else", () => {
    assert.deepEqual(masked(SIMPLE), ["Here is the shape:", " \n \n ", "That is all."]);
  });

  // The central case. A fence containing a blank line spans TWO block indices —
  // the blank line splits it on both sides, because both sides split the same
  // text the same way. It is not that the fence stays one block; it is that the
  // checker and the renderer agree it is two, so the renderer can join the
  // halves for display while still reporting the first half's index to the
  // gutter. Masking each line to a SPACE rather than to nothing is what keeps
  // that true: it preserves exactly which lines are empty.
  const SPANNING = "Before.\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\nAfter.";

  test("a fence containing a blank line spans two indices, identically on both sides", () => {
    assert.equal(splitBlocks(SPANNING).length, 4);
    assert.equal(masked(SPANNING).length, 4);
    assert.deepEqual(masked(SPANNING), ["Before.", " \n ", " \n ", "After."]);
  });

  test("it is still ONE fence: opened once, closed once, all code between", () => {
    assert.deepEqual(kinds(SPANNING), [
      "prose", // Before.
      "open",
      "code", // const a = 1;
      "code", // const b = 2;
      "close",
      "prose", // After.
    ]);
  });

  test("the blank line inside the fence is code, not a boundary the mask invented", () => {
    // The block boundary consumed it, so the renderer restores one blank line
    // per boundary. What must NOT happen is the checker seeing a boundary the
    // renderer does not, which is what an emptied (rather than spaced) code
    // line would produce.
    const blocks = splitBlocks(SPANNING);
    assert.equal(blocks[1].lines.at(-1).kind, "code");
    assert.equal(blocks[2].lines[0].kind, "code");
  });

  test("indentation inside a fence never reaches the checker", () => {
    const answer = "```\n    deeply.indented(true);\n```";
    assert.deepEqual(masked(answer), [" \n \n "]);
    // …but the renderer still has it verbatim.
    assert.equal(splitBlocks(answer)[0].lines[1].text, "    deeply.indented(true);");
  });

  test("a whitespace-only code line stays non-blank so it cannot move a boundary", () => {
    const answer = "```\na\n   \nb\n```";
    assert.equal(splitBlocks(answer).length, 1);
    assert.equal(masked(answer).length, 1);
  });

  test("tildes fence too, and a fence line may be indented up to three spaces", () => {
    assert.equal(isFenceLine("~~~"), true);
    assert.equal(isFenceLine("   ```python"), true);
    assert.equal(isFenceLine("    ```"), false, "four spaces is an indented code line");
    assert.equal(isFenceLine("`` not a fence"), false);
    assert.equal(isFenceLine("Use ``` for code"), false);
  });

  test("a marker-shaped token inside a fence is code, not a citation", () => {
    // Not this module's job to strip it — its job is to tell verify.ts that
    // these lines are not prose, which is what stops the check reading them.
    const answer = "```\nconst id = '[resume:nokia]';\n```";
    assert.deepEqual(masked(answer), [" \n \n "]);
  });
});

describe("splitBlocks — streaming", () => {
  // Every frame of a streamed answer is a prefix of the finished one, and the
  // model is mid-code-block for a lot of them.
  test("an unterminated fence does not crash and swallows nothing", () => {
    const answer = "Here:\n\n```ts\nconst a = 1;\nconst b = 2;";
    const blocks = splitBlocks(answer);
    assert.equal(blocks.length, 2);
    assert.deepEqual(
      blocks[1].lines.map((l) => l.kind),
      ["open", "code", "code"],
    );
    // The tail is still there, verbatim, for the renderer to draw.
    assert.deepEqual(
      blocks[1].lines.map((l) => l.text),
      ["```ts", "const a = 1;", "const b = 2;"],
    );
  });

  test("a bare opening fence on its own is a fence, not a paragraph", () => {
    assert.deepEqual(kinds("```"), ["open"]);
  });

  test("half an opening fence is prose until the third backtick lands", () => {
    assert.deepEqual(kinds("``"), ["prose"]);
    assert.deepEqual(kinds("```"), ["open"]);
  });

  test("every prefix of an answer splits without throwing", () => {
    const answer = "Intro.\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |";
    for (let i = 0; i <= answer.length; i += 1) {
      const prefix = answer.slice(0, i);
      const blocks = splitBlocks(prefix);
      assert.equal(blocks.length, masked(prefix).length, `prefix of length ${i}`);
    }
  });
});

describe("splitBlocks — tables and lists", () => {
  const TABLE = "| Field | Nokia |\n| --- | --- |\n| Role | Sales operations |\n| Start | Jun 2024 |";

  test("a pipe table is one block, every line intact", () => {
    const blocks = splitBlocks(`Compare:\n\n${TABLE}`);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[1].text, TABLE);
    assert.equal(blocks[1].lines.length, 4);
    assert.ok(blocks[1].lines.every((l) => l.kind === "prose"));
  });

  test("a table's delimiter row is not mistaken for a fence", () => {
    assert.equal(isFenceLine("| --- | --- |"), false);
    assert.equal(isFenceLine("---"), false, "a thematic break is not a fence");
  });

  test("a list is one block", () => {
    const blocks = splitBlocks("- One\n- Two\n- Three");
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].lines.length, 3);
  });
});

describe("splitBlocks — edges", () => {
  test("an empty answer is one empty block", () => {
    const blocks = splitBlocks("");
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].text, "");
    assert.deepEqual(masked(""), [""]);
  });

  test("leading blank lines produce a leading empty block, on both sides", () => {
    assert.deepEqual(raw("\n\nHello."), ["", "Hello."]);
    assert.deepEqual(masked("\n\nHello."), ["", "Hello."]);
  });

  test("a trailing blank line produces a trailing empty block, on both sides", () => {
    assert.deepEqual(raw("Hello.\n\n"), ["Hello.", ""]);
    assert.deepEqual(masked("Hello.\n\n"), ["Hello.", ""]);
  });

  test("surrounding spaces are content, not a boundary", () => {
    assert.deepEqual(raw("  Hello.  "), ["  Hello.  "]);
    // A line of spaces is not a blank line to `\n{2,}`.
    assert.equal(splitBlocks("A.\n   \nB.").length, 1);
  });

  test("an answer of only blank lines is empty blocks, not zero blocks", () => {
    assert.deepEqual(raw("\n\n\n\n"), ["", ""]);
  });
});

// --- The invariant --------------------------------------------------------
//
// This is the test that replaces the two prose comments. It reproduces what
// lib/verify.ts used to do — mask the WHOLE answer, then split it — and asserts
// that it comes out identical to splitting first and masking each block, which
// is what both consumers now do. Those two are equal only because masking a
// line never changes whether that line is empty; if anyone makes the mask emit
// "" for a code line, this is what fails, and it fails before a citation lands
// on the wrong paragraph in front of a reader.

/** The pre-refactor whole-document mask, kept here as the thing to agree with. */
function maskWholeAnswer(answer) {
  let open = false;
  return answer
    .split("\n")
    .map((line) => {
      if (isFenceLine(line)) {
        open = !open;
        return " ";
      }
      return open && line.trim() ? " " : line;
    })
    .join("\n");
}

const ANSWERS = {
  "plain prose": "He ran the rollout [resume:nokia].\n\nIt covered four regions.",
  "one paragraph": "Just the one thing to say.",
  "a list after a paragraph": "Three of them [resume:nokia]:\n\n- Nokia\n- Dell\n- Adarle",
  "a pipe table": "| Field | Nokia |\n| --- | --- |\n| Role | Sales operations |",
  "a fence with no blank line": "Like this:\n\n```ts\nconst rate = 0;\n```\n\nThat is the shape.",
  "a fence containing a blank line": "Before.\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\nAfter.",
  "a fence containing two blank lines": "Before.\n\n```js\na();\n\n\nb();\n```\n\nAfter.",
  "an indented fence": "Look:\n\n   ```\n   indented();\n   ```\n\nDone.",
  "a tilde fence": "Look:\n\n~~~\nvalue = 1\n~~~\n\nDone.",
  "an unterminated fence": "Here:\n\n```ts\nconst a = 1;\nconst b = 2;",
  "an unterminated fence with a blank line": "Here:\n\n```ts\nconst a = 1;\n\nconst b",
  "two fences": "One:\n\n```\na\n```\n\nTwo:\n\n```\nb\n```",
  "a heading and a table": "## Summary\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nDone [resume:nokia].",
  "wide gaps": "A.\n\n\n\nB.\n\n\nC.",
  "leading and trailing blanks": "\n\nMiddle.\n\n",
  "an empty answer": "",
  "prose that mentions backticks": "Write ``` to open a fence.\n\nThen close it.",
};

describe("the block index means the same thing on both sides", () => {
  for (const [name, answer] of Object.entries(ANSWERS)) {
    test(name, () => {
      const blocks = splitBlocks(answer);
      const checker = maskWholeAnswer(answer).split(/\n{2,}/);

      // Same number of blocks: the gutter has a slot for every rendered block
      // and no slot for a block that was never rendered.
      assert.equal(blocks.length, checker.length, "block count");

      // And block N is the same block: same index, same line count, and the
      // checker's text is this block's text with only its code lines blanked.
      blocks.forEach((block, i) => {
        assert.equal(block.index, i, `index of block ${i}`);
        assert.equal(maskedText(block), checker[i], `block ${i} masked`);
        assert.equal(
          block.text.split("\n").length,
          checker[i].split("\n").length,
          `block ${i} line count`,
        );
        assert.equal(block.lines.length, block.text.split("\n").length, `block ${i} lines`);
      });

      // The renderer's view is the answer itself, unmodified.
      assert.deepEqual(
        blocks.map((b) => b.text),
        answer.split(/\n{2,}/),
        "renderer sees the raw split",
      );
    });
  }

  test("masking never moves a boundary, for any of the above", () => {
    for (const [name, answer] of Object.entries(ANSWERS)) {
      const blanks = (s) => s.split("\n").map((l) => l === "");
      assert.deepEqual(
        blanks(maskWholeAnswer(answer)),
        blanks(answer),
        `${name}: which lines are empty must not change`,
      );
    }
  });
});
