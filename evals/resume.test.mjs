// The resume page against the resume source.
//
// `app/resume/page.tsx` is hand-typed JSX: employer names, datelines, titles
// and bullets, retyped from `content/knowledge/resume.md`. The markdown is the
// source of truth — it builds the chat corpus (`scripts/build-knowledge.mjs`)
// and `app/resume.md/route.ts` serves it raw. Nothing connected the two, so the
// rendered page could state a fact the record does not, and the chatbot would
// cite the markdown while the page beside it said something else. CLAUDE.md's
// rule is that facts about Sidhant come from `content/knowledge/`; this is the
// one surface where that rule had no enforcement.
//
// The check runs ONE WAY: everything checkable the page states must be
// supported by the markdown. The reverse is not asserted and should not be —
// the page is allowed to show less than the record (it omits A Darle 20's
// "— Toronto, ON", for instance), and a page that is a strict subset of the
// source cannot contradict it.
//
// WHAT COUNTS AS CHECKABLE is `lib/verify.ts`'s answer, not a second one. The
// site's own citation checker — the function that decides whether a model's
// sentence earns a verified mark — is pointed at the site's own page, with
// resume.md standing in as the cited chunk. That means the page is held to
// exactly the standard the chatbot is held to, and the leniency is already
// calibrated: `Mar 2026` matches "March 2026", "regions" matches "region", and
// ordinary English asserts nothing. Section headings, link labels and
// voice-and-tone connective writing carry no numbers and no proper nouns the
// record lacks, so they pass without being special-cased.
//
// On top of the token sweep, three things are checked as WHOLE CONTIGUOUS
// STRINGS rather than as loose tokens, because for these the arrangement is the
// fact. `present()` searches the whole markdown, so a token sweep alone would
// accept "Jun 2022 – Oct 2024" — every piece of it is somewhere in the file.
// Employers, datelines and date ranges have to appear as written.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { read } from "./lib/artifacts.mjs";
import { checkClaim, checkableTokens } from "../lib/verify.ts";

const PAGE = "app/resume/page.tsx";
const SOURCE = "content/knowledge/resume.md";

/**
 * The comment above the resume body, marking where retyped-from-the-PDF prose
 * starts. Everything before it — the page title, the /resume.md invitation, the
 * section nav — is site copy about the page rather than claims about Sidhant,
 * and the "last updated July 2026" in it is deliberately not in the resume.
 */
const BODY_ANCHOR = "{/* Resume body matches";

const ENTITIES = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&nbsp;": " ", "&mdash;": "—" };

/** JSX → the text a reader sees: tags, expressions and comments removed. */
function flatten(jsx) {
  return jsx
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    // `{" "}` and friends. Non-nested is enough: the body holds no expression
    // with braces inside it, and the array-mapped section nav that does is
    // above the anchor.
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&\w+;/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim();
}

/** The retyped resume, as JSX source. */
function bodySource(page) {
  const start = page.indexOf(BODY_ANCHOR);
  assert.notEqual(
    start,
    -1,
    `${PAGE} no longer carries the "${BODY_ANCHOR}" marker — this whole file is checking nothing until the anchor is restored`,
  );
  return page.slice(start, page.indexOf("</DocPage>"));
}

/**
 * The markdown as one line, bold markers gone.
 *
 * Collapsing the wrapping is what lets a contiguous-string check work at all:
 * the source hard-wraps at 78 columns, so "The University of Texas at Dallas,
 * 2016 – 2019" is split across two lines in the file and neither half is the
 * fact.
 */
function flatSource(md) {
  return md.replace(/\*\*/g, "").replace(/\s+/g, " ");
}

/** Employer / organisation headings, minus the trailing "case study →" link. */
function headings(body) {
  return [...body.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) =>
    flatten(m[1].split("<")[0]),
  );
}

/**
 * Datelines and the contact line, split on the `·` the page separates fields
 * with.
 *
 * Split rather than whole, because the page and the source disagree about
 * LAYOUT and only layout: the page lifts "Toronto, ON" into its own heading and
 * runs the rest of the contact details together, while the source keeps Toronto
 * inline and wraps after the email. Every field is identical; only the
 * arrangement of the line differs, and a whole-line check called that drift.
 * The fields are still checked contiguously, which is the part that matters —
 * "Jun 2024 – Present" is one field, not three tokens.
 */
function datelineFields(body) {
  return [...body.matchAll(/<p[^>]*font-mono[^>]*>([\s\S]*?)<\/p>/g)]
    .flatMap((m) => flatten(m[1]).split("·"))
    .map((f) => f.trim())
    .filter(Boolean);
}

/** `Jun 2024 – Present`, `2016 – 2019`, `May 2018 – Aug 2018`. */
const DATE_RANGE = /\b(?:[A-Z][a-z]{2,8} )?\d{4}\s*[–—-]\s*(?:(?:[A-Z][a-z]{2,8} )?\d{4}|Present)\b/g;

const page = read(PAGE);
const source = read(SOURCE);
const body = bodySource(page);
const bodyText = flatten(body);
const flatMd = flatSource(source);

/** resume.md as the single chunk the page is treated as citing. */
const LOOKUP = { [SOURCE]: { id: SOURCE, text: source } };

describe("the resume page cannot contradict the resume source", () => {
  test("every checkable fact in the body is supported by resume.md", () => {
    const check = checkClaim(bodyText, [SOURCE], LOOKUP);
    assert.equal(
      check.verdict,
      "verified",
      `${PAGE} states facts that ${SOURCE} does not support — missing: ${check.missing.join(", ")}. ` +
        `Do not edit either file to make this pass: one of them is wrong about Sidhant's own record, and which one is his call.`,
    );
  });

  test("the body actually contains facts to check", () => {
    // The sweep above would pass vacuously against an empty extraction — a
    // renamed anchor, a JSX refactor the flattener mishandles, a page rewritten
    // into a component this file cannot see. The count is the tripwire.
    assert.ok(
      checkableTokens(bodyText).length > 80,
      `only ${checkableTokens(bodyText).length} checkable tokens found in ${PAGE} — the extraction has probably broken, and the check above is passing for free`,
    );
  });

  test("every employer is named as resume.md names it", () => {
    const found = headings(body);
    assert.ok(found.length >= 4, `only ${found.length} employer headings found in ${PAGE}`);
    for (const heading of found) {
      assert.ok(
        flatMd.includes(heading),
        `${PAGE} heads a role "${heading}", which is not how ${SOURCE} writes it`,
      );
    }
  });

  test("every dateline field is written as resume.md writes it", () => {
    const fields = datelineFields(body);
    assert.ok(fields.length >= 12, `only ${fields.length} dateline fields found in ${PAGE}`);
    for (const field of fields) {
      assert.ok(
        flatMd.includes(field),
        `${PAGE} says "${field}", which is not in ${SOURCE} as written`,
      );
    }
  });

  test("every date range is written as resume.md writes it", () => {
    // Catches the education years too, which are prose rather than a dateline.
    const ranges = [...bodyText.matchAll(DATE_RANGE)].map((m) => m[0]);
    assert.ok(ranges.length >= 6, `only ${ranges.length} date ranges found in ${PAGE}`);
    for (const range of ranges) {
      assert.ok(
        flatMd.includes(range),
        `${PAGE} shows the range "${range}", which is not in ${SOURCE}`,
      );
    }
  });
});

// --- Calibration ------------------------------------------------------------
//
// The checks above pass on the files as they stand. These are the negative
// controls: they feed the same functions a page that HAS drifted, and fail if
// the drift goes unnoticed. Without them a flattener that quietly returned ""
// would look like a clean bill of health.

describe("drift the page could plausibly acquire", () => {
  const mutate = (from, to) => {
    const mutated = body.replace(from, to);
    assert.notEqual(mutated, body, `the fixture no longer matches ${PAGE}: "${from}"`);
    return mutated;
  };

  test("a wrong employer is caught", () => {
    const text = flatten(mutate("Dell Technologies", "Ericsson"));
    assert.equal(checkClaim(text, [SOURCE], LOOKUP).verdict, "unverified");
  });

  test("a wrong year is caught", () => {
    const text = flatten(mutate("May 2018 – Aug 2018", "May 2017 – Aug 2017"));
    assert.equal(checkClaim(text, [SOURCE], LOOKUP).verdict, "unverified");
  });

  test("a wrong figure is caught", () => {
    const text = flatten(mutate("1,400+ registered users", "2,700+ registered users"));
    assert.equal(checkClaim(text, [SOURCE], LOOKUP).verdict, "unverified");
  });

  test("a reshuffled date range is caught, though every token in it is real", () => {
    // The one the token sweep cannot see. "Jun", "2022", "Oct" and "2024" are
    // all in the source; only the arrangement is invented, so this is what the
    // contiguous check exists for.
    const mutated = mutate("Oct 2022 – Jun 2024", "Jun 2022 – Oct 2024");
    assert.equal(
      checkClaim(flatten(mutated), [SOURCE], LOOKUP).verdict,
      "verified",
      "the token sweep now catches reordered dates — this test's premise is stale",
    );
    assert.ok(
      datelineFields(mutated).some((f) => !flatMd.includes(f)),
      "a reshuffled date range passed the dateline check",
    );
  });

  test("a job title the record does not give him is caught", () => {
    const mutated = mutate("Marketing intern", "Marketing manager");
    assert.ok(
      datelineFields(mutated).some((f) => !flatMd.includes(f)),
      "an invented job title passed the dateline check",
    );
  });

  test("ordinary page prose is not mistaken for a claim", () => {
    // The reason this file scopes to the body and then trusts lib/verify.ts
    // rather than hand-rolling a word list. Headings, link labels and the
    // figcaption's connective writing are all in the extracted text above and
    // none of them flagged; these are the shapes that would have.
    for (const prose of [
      "Summary",
      "Technical skills",
      "case study →",
      "The Nokia work is internal tooling behind a corporate login, so there is nothing to show from it here.",
    ]) {
      assert.equal(
        checkClaim(prose, [SOURCE], LOOKUP).verdict,
        "verified",
        `page chrome "${prose}" reads as an unsupported claim`,
      );
    }
  });
});
