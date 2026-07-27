// Track B — project pages and recruiter copy. Static checks for #19 (the
// A Darle 20 media and feature surface), #20 (plain-language prose), #25 (the
// recruiter TL;DR) and #26 (the recruiter chips).
//
// Three of these are load-bearing rather than tidy, and they are all the same
// worry wearing different clothes: THIS IS THE TRACK THAT MAKES FACTUAL CLAIMS
// ABOUT SIDHANT. Everything Track A published was a claim about the site, which
// is checkable in this repo by anyone. A recruiter TL;DR is not — it is a claim
// a hiring manager can check against a person, and there is no way to walk one
// back once it has been read.
//
//   * "every TL;DR row survives the site's own citation checker" runs
//     lib/verify.ts — the same function that marks a model's sentence
//     unverified — over hand-written recruiter copy, against the corpus file
//     the row names. A number or a proper noun that stops being in the corpus
//     fails here rather than sitting on the homepage.
//
//   * "the plain-language sections introduce no figures" is the cheap version
//     of the same rule for prose. #20's job is to restate, not to add, and an
//     unsourced claim in explanatory copy is almost always shaped like a
//     number.
//
//   * "no media slot describes an asset that does not exist" is the asset half.
//     The roadmap's instruction for #19 was: do not fake a screenshot, do not
//     describe a video you have not seen. A caption without a file is exactly
//     that, and the type makes it impossible while this test makes it fail
//     loudly if the type is loosened.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { ROOT, read } from "./lib/artifacts.mjs";
import { checkClaim, checkableTokens } from "../lib/verify.ts";
import { looksLikeJobPosting } from "../lib/job-posting.ts";
import { looksLikeSiteQuestion } from "../lib/site-question.ts";
import {
  FIT_QUESTION,
  RECRUITER_TLDR,
  SUGGESTED_QUESTIONS,
  TLDR_FOOTER,
  TLDR_LABEL,
} from "../content/recruiter.ts";
import {
  ADARLE_MEDIA,
  FEATURE_SURFACE,
  FEATURE_SURFACE_NOTE,
} from "../content/adarle20-media.ts";

/** One synthetic chunk per corpus file, so checkClaim can be pointed at it. */
function corpusLookup(relativePath) {
  return { [relativePath]: { id: relativePath, text: read(relativePath) } };
}

// --- #25: the recruiter TL;DR ----------------------------------------------

describe("#25 — the recruiter TL;DR", () => {
  test("every row's facts are in the corpus file it names", () => {
    // The site's own checker, on the site's own copy. If a row cites
    // faq.md and says "Toronto", the word has to be in faq.md.
    for (const row of RECRUITER_TLDR) {
      const check = checkClaim(row.value, [row.source], corpusLookup(row.source));
      assert.equal(
        check.verdict,
        "verified",
        `TL;DR row "${row.label}" is not supported by ${row.source} — missing: ${check.missing.join(", ")}`,
      );
    }
  });

  test("every row's source file exists", () => {
    for (const row of RECRUITER_TLDR) {
      assert.ok(
        existsSync(join(ROOT, row.source)),
        `TL;DR row "${row.label}" names ${row.source}, which is not in the repo`,
      );
    }
  });

  test("every row actually asserts something checkable", () => {
    // A row with no numbers and no proper nouns in it would pass the check
    // above vacuously — verified because there was nothing to verify. That is
    // the failure mode this whole track is about, so it is asserted directly.
    for (const row of RECRUITER_TLDR) {
      assert.ok(
        checkableTokens(row.value).length > 0,
        `TL;DR row "${row.label}" contains nothing checkable — it is passing the corpus check for free`,
      );
    }
  });

  test("carries no unresolved markers", () => {
    for (const row of [...RECRUITER_TLDR.map((r) => r.value), TLDR_FOOTER, TLDR_LABEL]) {
      assert.ok(!row.includes("[VERIFY"), `"${row}" ships a [VERIFY] marker to the homepage`);
      assert.ok(!row.includes("[TODO"), `"${row}" ships a [TODO] marker to the homepage`);
    }
  });

  test("renders in the empty state only", () => {
    // The block is a substitute for having asked a question. Once there is a
    // conversation it is chrome, and it would sit above someone's transcript
    // on every reload.
    const shell = read("components/shell/app-shell.tsx");
    const uses = shell.match(/<RecruiterTldr\s*\/>/g) ?? [];
    assert.equal(uses.length, 1, "RecruiterTldr is rendered more than once in the shell");
    const emptyState = shell.slice(shell.indexOf("{!hasMessages && ("));
    assert.ok(
      emptyState.includes("<RecruiterTldr />"),
      "RecruiterTldr is rendered outside the !hasMessages branch — it would sit over a live conversation",
    );
  });

  test("is in docs/site-copy.md", () => {
    const copy = read("docs/site-copy.md").replace(/\s+/g, " ");
    for (const row of RECRUITER_TLDR) {
      assert.ok(
        copy.includes(row.value.replace(/\s+/g, " ")),
        `TL;DR row "${row.label}" is on the site but not in docs/site-copy.md`,
      );
    }
  });
});

// --- #26: the recruiter chips ----------------------------------------------

describe("#26 — the recruiter chips", () => {
  test("no chip is read as a pasted job posting", () => {
    // A false positive here forces a roleFit call on a turn that wanted a
    // paragraph — the site's own suggestion taking its worst path.
    for (const q of SUGGESTED_QUESTIONS) {
      assert.ok(!looksLikeJobPosting(q), `chip "${q}" is detected as a job posting`);
    }
  });

  test("no chip loads the repo corpus", () => {
    for (const q of SUGGESTED_QUESTIONS) {
      assert.ok(!looksLikeSiteQuestion(q), `chip "${q}" would load the second corpus`);
    }
  });

  test("the /fit command sends a chip verbatim", () => {
    assert.ok(
      SUGGESTED_QUESTIONS.includes(FIT_QUESTION),
      "/fit sends a question that is not one of the chips — two surfaces, two questions",
    );
    const data = read("components/shell/shell-data.ts");
    assert.ok(
      data.includes("message: FIT_QUESTION"),
      "the /fit command no longer reads the shared constant — the chip and the command can drift again",
    );
  });

  test("every chip is in docs/site-copy.md", () => {
    const copy = read("docs/site-copy.md");
    for (const q of SUGGESTED_QUESTIONS) {
      assert.ok(copy.includes(q), `chip "${q}" is unlogged in docs/site-copy.md`);
    }
  });

  test("the chips replaced the old set rather than adding to it", () => {
    // decisions #26: recruiter chips replace the current ones, no toggle.
    const shell = read("components/shell/app-shell.tsx");
    assert.ok(
      !shell.includes("What did Sidhant build at Nokia?"),
      "an old suggested question is still in the shell — #26 is a swap, not an addition",
    );
  });
});

// --- #20: plain-language prose ---------------------------------------------

const CASE_STUDIES = ["adarle20", "nokia", "dell-ml"];

describe("#20 — plain-language prose", () => {
  test("every case study opens with it", () => {
    for (const slug of CASE_STUDIES) {
      const mdx = read(`content/${slug}.mdx`);
      assert.ok(
        mdx.trimStart().startsWith("### In plain terms"),
        `content/${slug}.mdx does not open with the plain-language section`,
      );
    }
  });

  test("it is static, not generated", () => {
    // decisions #20: written once at build time, not a chat feature. An .mdx
    // file compiled into a pre-rendered page is the whole mechanism; this
    // asserts nobody has since wired a model into it.
    for (const slug of CASE_STUDIES) {
      const mdx = read(`content/${slug}.mdx`);
      for (const forbidden of ["fetch(", "useState", "streamText"]) {
        assert.ok(!mdx.includes(forbidden), `content/${slug}.mdx contains ${forbidden}`);
      }
    }
  });

  test("introduces no figures of its own", () => {
    // #20 restates; it does not add. An unsourced claim in explanatory copy is
    // almost always a number, so the section carries none at all — including
    // the ones that ARE in the corpus, because "some numbers here are sourced"
    // is not a rule anyone can check at a glance.
    for (const slug of CASE_STUDIES) {
      const mdx = read(`content/${slug}.mdx`);
      // "A Darle 20" is a product name, not a figure. It is the one string
      // allowed to carry a digit through this check.
      const section = mdx.slice(0, mdx.indexOf("###", 4)).replaceAll("A Darle 20", "");
      const digits = section.match(/\d/g) ?? [];
      assert.deepEqual(
        digits,
        [],
        `the plain-language section of content/${slug}.mdx contains a figure — it should restate, not assert`,
      );
    }
  });

  test("is in docs/site-copy.md", () => {
    const copy = read("docs/site-copy.md");
    for (const slug of CASE_STUDIES) {
      const mdx = read(`content/${slug}.mdx`);
      const section = mdx.slice(0, mdx.indexOf("###", 4));
      const firstSentence = section.split("\n\n")[1].replace(/\s+/g, " ").trim();
      assert.ok(
        copy.replace(/\s+/g, " ").includes(firstSentence),
        `the plain-language section of content/${slug}.mdx is not in docs/site-copy.md`,
      );
    }
  });
});

// --- #19: the A Darle 20 surface -------------------------------------------

describe("#19 — the media surface", () => {
  test("no slot describes an asset that does not exist", () => {
    // The one that matters. A caption, an alt string or a src without a file
    // behind it is a described screenshot nobody has seen.
    for (const slot of ADARLE_MEDIA) {
      if (!slot.asset) continue;
      assert.ok(slot.asset.src, `slot "${slot.id}" has an asset with no src`);
      assert.ok(slot.asset.alt, `slot "${slot.id}" has an image with no alt text`);
      assert.ok(
        existsSync(join(ROOT, "public", slot.asset.src)),
        `slot "${slot.id}" points at ${slot.asset.src}, which is not in public/`,
      );
    }
  });

  test("every empty slot briefs the person who has to capture it", () => {
    for (const slot of ADARLE_MEDIA) {
      if (slot.asset) continue;
      assert.ok(slot.brief.length > 40, `slot "${slot.id}" has no usable brief`);
      assert.ok(slot.aspect, `slot "${slot.id}" does not say what shape the file should be`);
      assert.ok(
        slot.aspectClass.includes("aspect-"),
        `slot "${slot.id}" has no aspect-ratio class, so its frame would collapse`,
      );
    }
  });

  test("at least one slot is still empty, and the page says so", () => {
    // Guards the renderer's placeholder path against bit-rotting unnoticed
    // while every slot happens to be full.
    const empty = ADARLE_MEDIA.filter((s) => !s.asset);
    assert.ok(empty.length > 0, "no empty slots left — delete this test with the placeholder path");
    const component = read("components/project-media.tsx");
    assert.ok(
      component.includes("Nothing here yet"),
      "the empty frame no longer says it is empty",
    );
  });

  test("slot ids are unique", () => {
    const ids = ADARLE_MEDIA.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, "two media slots share an id");
  });

  test("every slot is one of the three named kinds", () => {
    for (const slot of ADARLE_MEDIA) {
      assert.ok(
        ["screenshot", "screen recording", "video"].includes(slot.kind),
        `slot "${slot.id}" has an unknown kind "${slot.kind}"`,
      );
    }
  });
});

describe("#19 — the feature surface", () => {
  test("every feature is named in the corpus", () => {
    // The list is what the record says the product does, not what a
    // marketplace probably does. A plausible feature is a factual claim about
    // software a hiring manager can go and use.
    const corpus =
      read("content/knowledge/projects-adarle20.md") + "\n" + read("content/knowledge/resume.md");
    const lookup = { corpus: { id: "corpus", text: corpus } };
    for (const group of FEATURE_SURFACE) {
      for (const item of group.items) {
        const check = checkClaim(item, ["corpus"], lookup);
        assert.equal(
          check.verdict,
          "verified",
          `feature "${item}" is not named in the A Darle 20 record — missing: ${check.missing.join(", ")}`,
        );
      }
    }
  });

  test("the gap between the list and the product is marked, not filled", () => {
    assert.match(
      FEATURE_SURFACE_NOTE,
      /\[VERIFY/,
      "the feature surface no longer says it is incomplete — either it was completed from a source, or a guess was added",
    );
  });

  test("is in docs/site-copy.md", () => {
    const copy = read("docs/site-copy.md").replace(/\s+/g, " ");
    for (const group of FEATURE_SURFACE) {
      for (const item of group.items) {
        assert.ok(
          copy.includes(item.replace(/\s+/g, " ")),
          `feature "${item}" is unlogged in docs/site-copy.md`,
        );
      }
    }
  });

  test("the page renders both surfaces", () => {
    const page = read("app/projects/adarle20/page.tsx");
    assert.ok(page.includes("<AdarleFeatureSurface />"), "the feature surface is not on the page");
    assert.ok(page.includes("<AdarleMediaSurface />"), "the media surface is not on the page");
  });
});

// --- The ledger ------------------------------------------------------------

describe("the copy ledger", () => {
  test("every [VERIFY] marker in shipped copy is listed in the ledger", () => {
    // docs/copy-ledger.md's pending table exists so a [VERIFY] left in a file
    // can't quietly ship. This is the half that makes that true.
    const ledger = read("docs/copy-ledger.md");
    const pending = ledger.slice(ledger.indexOf("## Pending `[VERIFY]` markers"));
    for (const file of ["content/adarle20-media.ts", "content/recruiter.ts"]) {
      if (!read(file).includes("[VERIFY")) continue;
      assert.ok(
        pending.includes(file),
        `${file} carries a [VERIFY] marker that is not in the ledger's pending table`,
      );
    }
  });

  test("Track B's surfaces all have a ledger row", () => {
    const ledger = read("docs/copy-ledger.md");
    for (const where of [
      "content/recruiter.ts",
      "content/adarle20-media.ts",
      "components/project-media.tsx",
      "content/adarle20.mdx",
    ]) {
      assert.ok(ledger.includes(where), `${where} has no row in docs/copy-ledger.md`);
    }
  });
});
