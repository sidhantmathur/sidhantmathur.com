// Deterministic citation checking (roadmap Sprint 3, #21 — verified claims).
//
// The model is asked to attach chunk ids to the sentences that state facts (see
// lib/system-prompt.ts). This module is what makes that instruction worth
// anything: it takes the finished answer and checks, WITHOUT calling a model,
// that the numbers and proper nouns in each fact-bearing sentence actually
// appear in the chunk that sentence cited.
//
// The point is where the judgment lives. A model marking its own homework is
// decoration — it will agree with itself. Here a sentence is downgraded by
// string comparison against the corpus, and nothing the model writes can
// change the verdict.
//
// WHAT `verified` MEANS, EXACTLY: the numbers and proper nouns in this sentence
// appear in the chunk it cited. That is a narrower claim than "this sentence is
// true", and the UI must not round it up — a sentence can be verified and still
// be a bad summary of the chunk it points at. What the check does catch is the
// failure mode that matters here: a number, employer, tool, or date that is not
// in the record the answer says it came from.
//
// WHAT IT DELIBERATELY DOESN'T CHECK: sentences with no numbers and no proper
// nouns ("he likes owning the result"). There is nothing deterministic to check
// them against, and inventing a check would be the same self-certifying theatre
// this module exists to avoid. They are not claims as far as this file is
// concerned, and they are not counted, flagged, or marked.

// Deliberately dependency-free, including of the generated corpus: the caller
// passes the chunks in. That's what lets `node --test` exercise this against a
// hand-written fixture — the checker's behaviour is asserted on cases chosen to
// break it, not on whatever resume.md happens to say this week. Same reasoning
// as lib/transcript.ts.

/** The shape this module needs from a chunk. lib/chunks.generated satisfies it. */
export type VerifiableChunk = { id: string; text: string };

/**
 * A citation as it appears in an answer: `[resume:nokia]`.
 *
 * The lookahead keeps it off markdown links — `[label](href)` is a link even if
 * its label happens to contain a colon.
 */
const MARKER = /\[([a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*)\](?!\()/g;

/** The last, half-arrived marker of a streaming answer: `[resume:nok`. */
const PARTIAL_MARKER = /\[[a-z0-9:-]*$/;

/** Removes citation markers, leaving the prose a reader should see. */
export function stripCitations(text: string): string {
  return text
    .replace(MARKER, "")
    .replace(PARTIAL_MARKER, "")
    // A marker sits after the full stop, so removing it leaves a doubled space.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+$/gm, "");
}

/** Citation ids in a string, in order, without deduplication. */
export function citationIds(text: string): string[] {
  return [...text.matchAll(MARKER)].map((m) => m[1]!);
}

export type ClaimVerdict =
  /** Every number and proper noun in the sentence is in the chunk it cited. */
  | "verified"
  /** It cited something, and the something doesn't contain what it claims. */
  | "unverified"
  /** It states a checkable fact and cites nothing at all. */
  | "uncited";

export type Claim = {
  /** Index of the markdown block this sentence belongs to, for the margin. */
  blockIndex: number;
  /** The sentence, markers removed. */
  text: string;
  /** Cited ids that exist in the corpus. */
  ids: string[];
  /** Cited ids that do not. A fabricated id is a fabricated source. */
  unknownIds: string[];
  /** Tokens the cited chunks don't contain. Empty when verified. */
  missing: string[];
  verdict: ClaimVerdict;
};

/**
 * One piece of text checked against the chunks it names.
 *
 * Extracted from `verifyAnswer`'s inner loop so the job-description rows
 * (Sprint 4) get the SAME check as a sentence of prose. A second implementation
 * of "does the chunk contain this" is a second thing to calibrate, and Sprint 3
 * spent most of its time calibrating the first one.
 */
export type ClaimCheck = {
  ids: string[];
  unknownIds: string[];
  missing: string[];
  /** False when there is no number and no proper noun to check. */
  checkable: boolean;
  verdict: ClaimVerdict;
};

export function checkClaim(
  text: string,
  cited: string[],
  lookup: Record<string, VerifiableChunk>,
): ClaimCheck {
  const ids = cited.filter((id) => lookup[id]);
  const unknownIds = cited.filter((id) => !lookup[id]);
  const tokens = checkableTokens(text);

  if (!ids.length) {
    return { ids, unknownIds, missing: [], checkable: tokens.length > 0, verdict: "uncited" };
  }
  const haystack = normalize(ids.map((id) => lookup[id]!.text).join("\n"));
  const missing = tokens.filter((t) => !present(t, haystack));
  return {
    ids,
    unknownIds,
    missing,
    checkable: tokens.length > 0,
    verdict: missing.length || unknownIds.length ? "unverified" : "verified",
  };
}

export type BlockCheck = {
  index: number;
  ids: string[];
  unknownIds: string[];
  /** Claims in this block that were downgraded. */
  downgraded: number;
};

export type AnswerCheck = {
  /** The answer with markers removed — what actually gets rendered. */
  text: string;
  blocks: BlockCheck[];
  claims: Claim[];
  /** Every valid chunk id the answer touched, first appearance first. */
  citedIds: string[];
  unknownIds: string[];
  verified: number;
  downgraded: Claim[];
};

// --- Tokens ---------------------------------------------------------------

// Capitalized words that carry no claim: sentence openers, pronouns, the
// grammar around them, and the discourse markers a model reaches for when it
// lists things ("First, he built…"). Without this list every sentence starting
// with "The", "His" or "Second" would be treated as naming something, and the
// margin would fill with unverified marks that say nothing about the answer.
const STOPWORDS = new Set(
  `a an the and or but so if then than that this these those there here
   he him his she her hers they them their it its we us our you your i me my
   is are was were be been being am do does did done have has had having
   can could will would shall should may might must
   at in on of to for from with without into onto over under between across
   by as about after before during since until while when where why how what
   which who whom whose whether both each few more most other some such
   no nor not only own same too very just also still yet even though although
   because while during despite per via like unlike
   one two three four five six seven eight nine ten
   yes ok sure sorry thanks hi hello
   sidhant sidhants
   first second third fourth fifth next last finally also additionally
   however overall together meanwhile instead beyond plus notably importantly
   currently recently earlier later today unlike given either neither
   specifically essentially basically ultimately effectively practically
   generally typically similarly originally eventually throughout again
   want let happy feel hope note see ask think worth keep take look come
   thats hes shes theres heres whats lets ive im youre theyre well
   dont doesnt didnt cant wont isnt arent hasnt havent wasnt werent`
    .split(/\s+/)
    .filter(Boolean),
);

/** Digit runs: `1,400`, `4.96`, `20,000`, `2024`. */
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/** Capitalized words, keeping internal punctuation: `Power`, `B.S.`, `OXXO`. */
const NAME = /\b[A-Z][A-Za-z0-9&.'’/-]*/g;

/** Lowercases, drops apostrophes, and closes up thousands separators. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/(\d),(?=\d)/g, "$1");
}

/** Strips the markdown subset the model is allowed to emit, keeping link text. */
function plain(sentence: string): string {
  return sentence
    .replace(/\[([^\]\n]+)\]\([^)\s]*\)/g, "$1")
    .replace(/[`*_]/g, "");
}

/**
 * The parts of a sentence that can be checked against a source: its numbers and
 * its proper nouns. Everything else is phrasing, and phrasing is not checkable
 * without a model.
 */
export function checkableTokens(sentence: string): string[] {
  const text = plain(sentence);
  // A question asserts nothing. The model ends most answers with an offer to
  // go deeper, and marking "Want to see how the payments work?" as an uncited
  // claim was the single loudest false alarm in the first live run.
  if (/\?\s*$/.test(text)) return [];
  const tokens: string[] = [];

  // The trailing comma of "in 2026, he shipped" is punctuation, not a digit.
  for (const match of text.matchAll(NUMBER)) tokens.push(match[0].replace(/,+$/, ""));

  for (const match of text.matchAll(NAME)) {
    const raw = match[0].replace(/[.,;:!?'’]+$/, "");
    if (raw.length < 2) continue;
    // A compound the answer joins and the corpus writes apart:
    // "TypeScript/Next.js", "Salesforce-to-Power", "LLM-integrated". Each
    // CAPITALIZED part is a name to look for; the lowercase parts are ordinary
    // English holding them together ("to", "integrated") and assert nothing.
    // Sprint 4's live run flagged two honest rows on this alone.
    for (const part of raw.split(/[/-]/)) {
      if (part.length < 2 || !/^[A-Z]/.test(part)) continue;
      if (STOPWORDS.has(normalize(part))) continue;
      tokens.push(part);
    }
  }

  // Deduplicated case-insensitively so "Nokia … Nokia" is one thing to find.
  const seen = new Set<string>();
  return tokens.filter((t) => {
    const key = normalize(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Endings a claim's wording adds to a word the corpus spells plainly. */
const SUFFIXES = ["s", "es", "ed", "ing", "ly", "an", "ian", "n"];

// The resume writes datelines as `Mar 2026`; an answer writes "March 2026".
// Nothing about that is a discrepancy, and flagging it would put an unverified
// mark on the single most commonly restated fact in the corpus.
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Is this token findable in the cited text?
 *
 * Lenient about word endings and nothing else: "regions" against "region",
 * "Nokia's" against "Nokia" (the apostrophe is already gone), "Mexican"
 * against "Mexico". The leniency runs ONE WAY on purpose. This module reports
 * absence, and an absence it reports becomes a mark on the screen — so a
 * near-miss must never become an accusation. The cost is that a hallucination
 * sharing a five-character stem with something in the chunk slips through,
 * which is a trade worth making: the mark is only useful if it's believed.
 */
function present(token: string, haystack: string): boolean {
  const needle = normalize(token);
  if (haystack.includes(needle)) return true;
  if (MONTHS.includes(needle) && haystack.includes(needle.slice(0, 3))) return true;
  for (const suffix of SUFFIXES) {
    if (!needle.endsWith(suffix)) continue;
    const stem = needle.slice(0, -suffix.length);
    // A plural is a safe unwrap at any length ("hosts" → "host"). The rest
    // reshape the word, so they need enough stem left to still be specific.
    const floor = suffix === "s" ? 3 : 5;
    if (stem.length >= floor && haystack.includes(stem)) return true;
  }
  return false;
}

// --- Sentences ------------------------------------------------------------

/**
 * Splits a block into sentences, one list item per sentence at minimum.
 *
 * Deliberately simple. An over-eager split costs a claim its citation and shows
 * a false "uncited"; the abbreviation this corpus actually contains is `B.S.`,
 * which is handled by requiring a following space AND capital.
 */
function sentencesOf(block: string): string[] {
  return block
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z[])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

// --- The check ------------------------------------------------------------

/**
 * Runs the post-pass over a finished answer.
 *
 * A sentence with no marker of its own inherits its paragraph's — models cite
 * at the end of a paragraph as often as at the end of a sentence, and treating
 * that as "uncited" would flag honest answers. `uncited` therefore means the
 * whole block cited nothing, which is unambiguous.
 */
export function verifyAnswer(
  answer: string,
  lookup: Record<string, VerifiableChunk>,
): AnswerCheck {
  const rawBlocks = answer.split(/\n{2,}/);
  const blocks: BlockCheck[] = [];
  const claims: Claim[] = [];
  const citedIds: string[] = [];
  const unknownIds: string[] = [];

  rawBlocks.forEach((block, index) => {
    const blockIds = citationIds(block);
    // Deduped: a block that cites the same chunk in two sentences names one
    // source, not two. Undeduped, the margin listed it twice and React saw
    // two children under one key — so it dropped one and warned.
    // `citationIds` stays raw because per-sentence checking wants the
    // sentence's own list exactly as written.
    const blockValid = [...new Set(blockIds.filter((id) => lookup[id]))];
    const blockUnknown = [...new Set(blockIds.filter((id) => !lookup[id]))];

    for (const id of blockValid) if (!citedIds.includes(id)) citedIds.push(id);
    for (const id of blockUnknown) if (!unknownIds.includes(id)) unknownIds.push(id);

    let downgraded = 0;

    for (const sentence of sentencesOf(block)) {
      const own = citationIds(sentence);
      const text = stripCitations(sentence).trim();
      // `uncited` below therefore means: either nothing was cited, or
      // everything cited was invented. Both are the same failure to the
      // reader — there is no source to open.
      const check = checkClaim(text, own.length ? own : blockIds, lookup);
      // Not a claim: nothing here can be checked against anything.
      if (!check.checkable) continue;

      if (check.verdict !== "verified") downgraded += 1;
      claims.push({
        blockIndex: index,
        text,
        ids: check.ids,
        unknownIds: check.unknownIds,
        missing: check.missing,
        verdict: check.verdict,
      });
    }

    blocks.push({ index, ids: blockValid, unknownIds: blockUnknown, downgraded });
  });

  return {
    text: stripCitations(answer),
    blocks,
    claims,
    citedIds,
    unknownIds,
    verified: claims.filter((c) => c.verdict === "verified").length,
    downgraded: claims.filter((c) => c.verdict !== "verified"),
  };
}
