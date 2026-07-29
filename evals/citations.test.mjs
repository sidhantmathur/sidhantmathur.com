// Layer 1 — the grounding backbone (roadmap Sprint 3: F2, #21, #12, #4).
//
// Two things are tested here, and the second is the point of the sprint.
//
//   1. THE ID SPACE. Every chunk the panel can render is addressable, unique,
//      and actually present in the knowledge base the model reads. An id that
//      exists in one and not the other is the failure that makes citation
//      theatre: the model cites something the site can't open, or the site
//      offers a source the model was never shown.
//
//   2. THE DOWNGRADE PATH. A claim whose numbers and names are not in the chunk
//      it cited must be marked by CODE. These are the cases that separate a
//      real check from a badge — especially `cites a real chunk that doesn't
//      contain the number`, which is the only failure a naive "did it cite
//      anything?" test would pass.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  checkableTokens,
  citationIds,
  stripCitations,
  verifyAnswer,
} from "../lib/verify.ts";
import { messageToMarkdown } from "../lib/transcript.ts";
import { estimateTokens, read, readChunks, readKnowledgeBase } from "./lib/artifacts.mjs";

const CHUNKS = readChunks();
const BY_ID = Object.fromEntries(CHUNKS.map((c) => [c.id, c]));

// A fixed, hand-written corpus for the verifier tests. Deliberately NOT the
// real one: these assert the behaviour of the checker, and they should not
// start failing because a number in resume.md changed. The real corpus is
// asserted against separately, further down.
const FIXTURE = {
  "resume:nokia": {
    id: "resume:nokia",
    source: "resume",
    sourceLabel: "Resume",
    heading: "Nokia — Toronto, ON",
    meta: "Sales operations specialist · Jun 2024 – Present",
    lines: ["Built a self-serve Power App used by 80+ stakeholders across 7 regions."],
    text: "Nokia — Toronto, ON\nSales operations specialist · Jun 2024 – Present\nBuilt a self-serve Power App used by 80+ stakeholders across 7 regions.",
  },
  "adarle20:where-it-stands": {
    id: "adarle20:where-it-stands",
    source: "adarle20",
    sourceLabel: "A Darle 20",
    heading: "Where it stands",
    meta: "",
    lines: ["Four months in, it has 1,400+ registered users and 127 hosts."],
    text: "Where it stands\nFour months in, it has 1,400+ registered users and 127 hosts.",
  },
};

describe("the id space", () => {
  test("every chunk id is unique and shaped <source>:<slug>", () => {
    assert.ok(CHUNKS.length >= 20, `only ${CHUNKS.length} chunks — did the build run?`);
    const ids = CHUNKS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate chunk ids: ${ids.join(", ")}`);
    for (const id of ids) {
      assert.match(
        id,
        /^[a-z0-9]+(-[a-z0-9]+)*:[a-z0-9]+(-[a-z0-9]+)*$/,
        `chunk id "${id}" doesn't match the citation marker format — the model could never emit it`,
      );
    }
  });

  test("the corpus is the whole corpus, not just the resume", () => {
    // F2's actual requirement. Before Sprint 3 only resume.md was citable, so
    // an answer built from the case studies or the FAQ had nothing to point at.
    const sources = new Set(CHUNKS.map((c) => c.source));
    for (const source of ["resume", "bio", "adarle20", "nokia", "dell", "faq"]) {
      assert.ok(sources.has(source), `no chunks from "${source}" — that file is uncitable`);
    }
  });

  test("every chunk carries content and a haystack to check against", () => {
    for (const c of CHUNKS) {
      assert.ok(c.heading, `chunk "${c.id}" has no heading`);
      assert.ok(c.lines?.length > 0, `chunk "${c.id}" has no lines — the panel would render blank`);
      assert.ok(c.text?.length > 20, `chunk "${c.id}" has no text — nothing could verify against it`);
      for (const line of c.lines) {
        assert.ok(c.text.includes(line), `chunk "${c.id}" renders a line that isn't in its own text`);
      }
    }
  });

  test("every id is in the knowledge base the model reads", () => {
    const kb = readKnowledgeBase();
    for (const c of CHUNKS) {
      const marker = `[${c.id}]`;
      const first = kb.indexOf(marker);
      assert.notEqual(first, -1, `chunk "${c.id}" is citable but never appears in the prompt`);
      assert.equal(
        kb.indexOf(marker, first + 1),
        -1,
        `chunk id "${c.id}" appears twice in the prompt — an ambiguous citation`,
      );
    }
  });

  test("the knowledge base names no id the site can't open", () => {
    // The other direction: a marker in the prompt with no chunk behind it would
    // teach the model to cite something that opens nothing.
    for (const id of citationIds(readKnowledgeBase())) {
      assert.ok(BY_ID[id], `the prompt shows "[${id}]", which is not a chunk`);
    }
  });

  test("the ids the shell hardcodes still exist", () => {
    // SLUG_TO_RESUME in shell-data.ts maps a project slug onto a chunk. If a
    // heading in resume.md changes, the chip silently opens nothing.
    const shellData = read("components/shell/shell-data.ts");
    for (const id of ["resume:a-darle-20", "resume:nokia"]) {
      assert.ok(BY_ID[id], `SLUG_TO_RESUME points at "${id}", which is no longer a chunk id`);
      assert.ok(shellData.includes(id), `shell-data.ts no longer maps to "${id}"`);
    }
  });

  test("labeling the chunks didn't blow the prompt budget", () => {
    // The ids are worth tokens on every single turn, cached or not. This is
    // the check that keeps that price honest.
    const tokens = estimateTokens(readKnowledgeBase());
    assert.ok(tokens < 8000, `knowledge base is ~${tokens} tokens, over the 8k target`);
  });
});

describe("the system prompt teaches the vocabulary", () => {
  const src = read("lib/system-prompt.ts");

  test("it shows the marker format with a real id", () => {
    const ids = citationIds(src).filter((id) => BY_ID[id]);
    assert.ok(
      ids.length >= 2,
      "the ## Citing section demonstrates no real chunk id — the model has only a description to work from",
    );
  });

  test("it says the check is deterministic", () => {
    // The instruction only changes behaviour if the model knows a wrong id is
    // worse than no id. Losing this sentence is a silent quality regression.
    assert.match(src, /unverified/i);
    assert.match(src, /string\s+comparison/i);
  });
});

describe("markers come out of the prose", () => {
  test("a marker is removed and its spacing closed up", () => {
    const text = "He built it at Nokia. [resume:nokia] It shipped.";
    assert.equal(stripCitations(text), "He built it at Nokia. It shipped.");
  });

  test("a half-arrived marker doesn't flash while streaming", () => {
    assert.equal(stripCitations("He built it at Nokia. [resume:no"), "He built it at Nokia.");
  });

  test("a markdown link is not a citation", () => {
    const text = "See the [resume](/resume) for the long version.";
    assert.equal(stripCitations(text), text);
    assert.deepEqual(citationIds(text), []);
  });

  test("the transcript's copy of the regex agrees with the verifier's", () => {
    // lib/transcript.ts keeps its own regex so it stays free of the generated
    // corpus. This is what stops the two from drifting.
    const text = "He built it at Nokia. [resume:nokia] See the [resume](/resume).";
    const copied = messageToMarkdown({ role: "assistant", parts: [{ type: "text", text }] });
    assert.ok(copied.startsWith(stripCitations(text)), `transcript stripped differently:\n${copied}`);
    assert.ok(copied.includes("Sources: resume:nokia"), "the copied answer lost its provenance");
  });
});

describe("what counts as a claim", () => {
  test("numbers and proper nouns are checkable", () => {
    const tokens = checkableTokens("He built a Power App for 80+ stakeholders at Nokia.");
    assert.deepEqual(tokens, ["80", "Power", "App", "Nokia"]);
  });

  test("a refusal states nothing checkable", () => {
    // The site's own decline copy. Flagging this as an uncited claim would put
    // an "unverified" mark under every out-of-scope question.
    const tokens = checkableTokens(
      "I can only help with questions about Sidhant's background and work — happy to answer one of those instead.",
    );
    assert.deepEqual(tokens, [], `treated as claims: ${tokens.join(", ")}`);
  });

  test("an unfalsifiable sentence is not a claim", () => {
    assert.deepEqual(checkableTokens("He likes owning the result, support and bugs and all."), []);
  });
});

describe("the downgrade path", () => {
  const check = (text) => verifyAnswer(text, FIXTURE);

  test("a claim whose numbers are in the chunk it cited is verified", () => {
    const result = check(
      "He built a Power App used by 80+ stakeholders across 7 regions. [resume:nokia]",
    );
    assert.equal(result.claims.length, 1);
    assert.equal(result.claims[0].verdict, "verified");
    assert.deepEqual(result.downgraded, []);
    assert.deepEqual(result.citedIds, ["resume:nokia"]);
  });

  test("a claim citing a REAL chunk that lacks its number is downgraded", () => {
    // The case that matters. The citation is well-formed, the chunk exists, the
    // panel would open — and the number is not in it. Nothing but reading the
    // source catches this, which is why a model can't be the one checking.
    const result = check("He built a Power App used by 900 stakeholders. [resume:nokia]");
    assert.equal(result.claims[0].verdict, "unverified");
    assert.deepEqual(result.claims[0].missing, ["900"]);
    assert.equal(result.verified, 0);
  });

  test("a proper noun the cited chunk never mentions is downgraded", () => {
    const result = check("He migrated the reporting stack to Snowflake. [resume:nokia]");
    assert.equal(result.claims[0].verdict, "unverified");
    assert.deepEqual(result.claims[0].missing, ["Snowflake"]);
  });

  test("an id that doesn't exist is downgraded, not silently accepted", () => {
    const result = check("He shipped it in 2019. [resume:invented-section]");
    assert.equal(result.claims[0].verdict, "uncited");
    assert.deepEqual(result.claims[0].unknownIds, ["resume:invented-section"]);
    assert.deepEqual(result.citedIds, []);
    assert.deepEqual(result.unknownIds, ["resume:invented-section"]);
  });

  test("a fact with no citation at all is downgraded", () => {
    const result = check("He grew it to 1,400 users in four months.");
    assert.equal(result.claims[0].verdict, "uncited");
    assert.equal(result.downgraded.length, 1);
  });

  test("a mixed answer keeps the good sentence and downgrades the bad one", () => {
    const result = check(
      "He built a Power App used by 80+ stakeholders. [resume:nokia]\n\n" +
        "It runs on Snowflake. [resume:nokia]",
    );
    assert.equal(result.verified, 1);
    assert.equal(result.downgraded.length, 1);
    assert.equal(result.downgraded[0].blockIndex, 1);
    // The margin renders per block, so the block index has to be right or the
    // mark lands next to the wrong paragraph.
    assert.equal(result.blocks[0].downgraded, 0);
    assert.equal(result.blocks[1].downgraded, 1);
  });

  test("a paragraph's citation covers its sentences", () => {
    // Models cite at the end of a paragraph as often as at the end of a
    // sentence. Reading that as "uncited" would flag honest answers, so the
    // block's ids stand in for a sentence that names none of its own.
    const result = check(
      "He works at Nokia. He built a Power App used by 80+ stakeholders. [resume:nokia]",
    );
    assert.equal(result.claims.length, 2);
    assert.ok(result.claims.every((c) => c.verdict === "verified"));
  });

  test("two chunks are checked as one haystack when both are cited", () => {
    const result = check(
      "He works at Nokia, and it has 127 hosts. [resume:nokia] [adarle20:where-it-stands]",
    );
    assert.equal(result.claims[0].verdict, "verified");
    assert.equal(result.citedIds.length, 2);
  });

  test("verified counts only what was actually checked", () => {
    // A sentence with nothing checkable in it is not a claim, and must not be
    // counted as a verified one — that would be the badge this sprint exists to
    // avoid.
    const result = check("He likes owning the result. [resume:nokia]");
    assert.deepEqual(result.claims, []);
    assert.equal(result.verified, 0);
  });

  test("the rendered text has no markers left in it", () => {
    const result = check("He works at Nokia. [resume:nokia]");
    assert.equal(result.text, "He works at Nokia.");
  });
});

// Every case below is a false "unverified" that a live run against the real
// corpus actually produced (2026-07-27, grounded group). They are here because
// a checker that cries wolf is worse than no checker: a visitor who sees the
// mark on a correct sentence learns to ignore it, and then it can't do its job
// on the sentence that's wrong.
describe("false alarms the live corpus produced", () => {
  test("a discourse marker is not a proper noun", () => {
    // "First, he built…" / "Second, he owned…" — the model's list scaffolding.
    const result = verifyAnswer(
      "First, he built a Power App used by 80+ stakeholders. [resume:nokia]",
      FIXTURE,
    );
    assert.equal(result.claims[0].verdict, "verified", `flagged: ${result.claims[0].missing}`);
  });

  test("a number keeps its digits and drops its comma", () => {
    assert.deepEqual(checkableTokens("In March 2026, it launched."), ["2026", "March"]);
  });

  test("a question is not a claim", () => {
    // Most answers end with an offer to go deeper. Marking "Want to see how
    // the payments work?" as an uncited claim was the loudest false alarm of
    // the lot.
    assert.deepEqual(checkableTokens("Want to hear how the Nokia rollout went?"), []);
  });

  test("a compound the corpus writes as two words is not a fabrication", () => {
    // Sprint 4's live run: rows citing chunks that say "TypeScript", "Next.js"
    // and "LLM" separately, flagged for writing "TypeScript/Next.js" and
    // "LLM-integrated". Both halves are in the chunk; the punctuation between
    // them is phrasing, and phrasing is not a claim.
    const result = verifyAnswer(
      "He shipped it in TypeScript/Next.js with LLM-integrated tooling. [resume:nokia]",
      {
        "resume:nokia": {
          id: "resume:nokia",
          text: "He shipped it in TypeScript on Next.js, with LLM tooling in the loop.",
        },
      },
    );
    assert.equal(result.claims[0].verdict, "verified", `flagged: ${result.claims[0].missing}`);
  });

  test("a compound whose halves are NOT both present is still flagged", () => {
    const result = verifyAnswer("He shipped it in Rust/Kubernetes. [resume:nokia]", {
      "resume:nokia": { id: "resume:nokia", text: "He shipped it in TypeScript." },
    });
    assert.equal(result.claims[0].verdict, "unverified");
  });

  test("a derived form matches the word the corpus uses", () => {
    // The model wrote "Mexican customer base" against a chunk that says
    // "players in Mexico".
    const result = verifyAnswer(
      "It was built for a Mexican audience across 7 regions. [resume:nokia]",
      { "resume:nokia": { id: "resume:nokia", text: "He shipped it in Mexico across 7 regions." } },
    );
    assert.equal(result.claims[0].verdict, "verified", `flagged: ${result.claims[0].missing}`);
  });

  test("a month spelled out matches a dateline that abbreviates it", () => {
    // "launching in March 2026" against a resume dateline reading "Mar 2026".
    const result = verifyAnswer("It launched in March 2026. [resume:a-darle-20]", BY_ID);
    assert.equal(result.claims[0].verdict, "verified", `flagged: ${result.claims[0].missing}`);
  });

  test("leniency stops well short of accepting anything", () => {
    // The floor on stemming is what keeps the check a check.
    const result = verifyAnswer("He used Snowflake there. [resume:nokia]", FIXTURE);
    assert.equal(result.claims[0].verdict, "unverified");
  });

  test("the source label is part of what a chunk can evidence", () => {
    // "A Darle 20" appears in the label line of every A Darle 20 chunk and in
    // the body of almost none of them. The model reads that line; so must the
    // checker.
    for (const chunk of CHUNKS) {
      assert.ok(
        chunk.text.startsWith(`${chunk.sourceLabel} — ${chunk.heading}`),
        `chunk "${chunk.id}" is checked against different text than the model reads`,
      );
    }
    const result = verifyAnswer(
      "A Darle 20 has 127 hosts. [adarle20:where-it-stands]",
      BY_ID,
    );
    assert.equal(result.claims[0].verdict, "verified", `flagged: ${result.claims[0].missing}`);
  });
});

describe("the real corpus verifies against itself", () => {
  // An end-to-end check with no fixture: a sentence lifted from a chunk, cited
  // to that chunk, must verify. If the tokenizer and the chunk text ever stop
  // agreeing — a different apostrophe, a lost dateline — every honest answer
  // starts rendering as unverified, and this is the test that says so.
  for (const id of ["resume:nokia", "adarle20:where-it-stands", "faq:location"]) {
    test(`a sentence quoted from ${id} verifies against it`, () => {
      const chunk = BY_ID[id];
      assert.ok(chunk, `${id} is missing from the corpus`);
      const sentence = chunk.lines[0].split(/(?<=[.!?])\s/)[0];
      const result = verifyAnswer(`${sentence} [${id}]`, BY_ID);
      const bad = result.downgraded.map((c) => `${c.verdict}: ${c.missing.join(", ")}`);
      assert.deepEqual(bad, [], `quoting ${id} back at itself did not verify`);
    });
  }
});

describe("fenced code is not prose", () => {
  // Code blocks arrived with the aicss polish pass. The check has to ignore
  // what's inside them, and — the part that fails silently — it has to keep
  // counting blocks the way components/shell/markdown.tsx does, because the
  // margin renders `blocks[i]` beside the paragraph the renderer calls `i`.

  test("lines inside a fence produce no claims", () => {
    const answer = [
      "He built the rate meter. [adarle20:where-it-stands]",
      "",
      "```ts",
      "const rate = samples.reduce((a, b) => a + b, 0) / samples.length;",
      "return Math.round(rate);",
      "```",
    ].join("\n");
    const result = verifyAnswer(answer, BY_ID);
    const fromCode = result.claims.filter((c) => c.text.includes("samples"));
    assert.deepEqual(fromCode, [], "a line of code was checked as a claim");
  });

  test("masking a fence does not shift later block indices", () => {
    // The invariant, stated exactly: masking changes what a block SAYS and
    // never how many there are. A blank line inside a fence already splits the
    // answer into two blocks before the mask runs — the renderer joins them
    // back for display and reports the first index — so what matters is that
    // the mask agrees with the unmasked split, block for block.
    //
    // The failure this exists for: mask by emptying lines instead of spacing
    // them, and `code` below becomes blank, splitting one more time and
    // pushing the closing paragraph's citation into the margin of the
    // paragraph above it.
    const answer = [
      "First paragraph. [resume:nokia]", // block 0
      "",
      "```", // blocks 1 and 2 — the fence, split by its own blank line
      "code",
      "",
      "more code",
      "```",
      "",
      "Last paragraph. [faq:location]", // block 3
    ].join("\n");
    const result = verifyAnswer(answer, BY_ID);
    assert.equal(
      result.blocks.length,
      answer.split(/\n{2,}/).length,
      "masking changed how many blocks the answer has",
    );
    assert.deepEqual(result.blocks[0].ids, ["resume:nokia"]);
    assert.deepEqual(result.blocks[3].ids, ["faq:location"]);
    // And the fence's own blocks carry nothing, so the margin stays empty
    // beside the code rather than inheriting the paragraph above it.
    assert.deepEqual(result.blocks[1].ids, []);
    assert.deepEqual(result.blocks[2].ids, []);
  });

  test("an unterminated fence still swallows the rest", () => {
    // Every frame of a streaming answer is a half-written one, and for most of
    // them the closing fence hasn't arrived yet.
    const result = verifyAnswer("Here it is.\n\n```ts\nconst x = 1;", BY_ID);
    assert.deepEqual(
      result.claims.filter((c) => c.text.includes("const x")),
      [],
      "a streaming code block was checked as prose",
    );
  });

  test("prose after a closed fence is checked again", () => {
    const answer = "```\ncode\n```\n\nHe worked at Nokia in Toronto. [resume:nokia]";
    const result = verifyAnswer(answer, BY_ID);
    assert.ok(
      result.claims.some((c) => c.text.includes("Nokia")),
      "the mask never turned back off",
    );
  });
});

describe("stripCitations leaves code alone", () => {
  test("indentation inside a fence survives", () => {
    // The collapse of runs of spaces is a prose repair for the gap a removed
    // marker leaves behind. Applied to code it eats the indentation, which is
    // the one thing a code block is for.
    const answer = ["```ts", "if (x) {", "    return 1;", "}", "```"].join("\n");
    assert.equal(stripCitations(answer), answer);
  });

  test("a marker-shaped token inside a fence is not stripped", () => {
    const answer = ["```", "const key = map[resume:nokia];", "```"].join("\n");
    assert.ok(stripCitations(answer).includes("map[resume:nokia]"));
  });

  test("prose outside the fence is still cleaned", () => {
    const out = stripCitations("He works at Nokia. [resume:nokia]\n\n```\ncode\n```");
    assert.ok(!out.includes("[resume:nokia]"));
    assert.ok(out.includes("He works at Nokia."));
  });
});

describe("a table row is a claim, its header is not", () => {
  const table = [
    "| Field | Nokia |",
    "| --- | --- |",
    "| Role | Sales operations specialist |",
    "| Users | Power App used by 80+ stakeholders across 7 regions [resume:nokia] |",
  ].join("\n");

  test("the header and delimiter rows produce no claims", () => {
    const result = verifyAnswer(table, FIXTURE);
    assert.ok(
      !result.claims.some((c) => c.text.startsWith("Field")),
      "the column labels were checked as a factual claim",
    );
    assert.ok(
      !result.claims.some((c) => c.text.includes("---")),
      "the delimiter row was checked as a factual claim",
    );
  });

  test("a body row is checked, without its pipes or its row label", () => {
    const result = verifyAnswer(table, FIXTURE);
    const row = result.claims.find((c) => c.text.includes("80+"));
    assert.ok(row, "a row stating facts was not checked at all");
    assert.ok(!row.text.includes("|"), `the markup was quoted as the claim: ${row.text}`);
    // "Users" is the row's label, chosen by the model for formatting. It is
    // not in any chunk and never will be, so checking it would fail every
    // honest row.
    assert.ok(!row.text.startsWith("Users"), `the row label was checked: ${row.text}`);
    assert.equal(row.verdict, "verified", "a row quoting its cited chunk did not verify");
  });

  test("a row whose numbers aren't in the chunk it cites is downgraded", () => {
    // The point of checking rows at all: a table must not be a way to state a
    // number without one.
    const bad = [
      "| Field | Nokia |",
      "| --- | --- |",
      "| Users | Power App used by 900+ stakeholders [resume:nokia] |",
    ].join("\n");
    const result = verifyAnswer(bad, FIXTURE);
    // The tokenizer normalises "900+" to "900" — the check is on the number,
    // not on how it was written.
    assert.ok(
      result.downgraded.some((c) => c.missing.includes("900")),
      "a wrong number inside a table cell was not caught",
    );
  });
});
