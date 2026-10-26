// Deterministic citation checking: the model attaches chunk ids to the
// sentences that state facts (see lib/system-prompt.ts), and this checks,
// without calling a model, that the numbers and proper nouns in each such
// sentence appear in the chunk it cited.
//
// `verified` means exactly that, which is narrower than "true", and the UI must
// not round it up. A failed check splits in two: `miscited` when the missing
// token is elsewhere in the record (a true fact behind the wrong pointer) and
// `unverified` when it is nowhere. Only the second gets the accent.
//
// Sentences with no numbers and no proper nouns ("he likes owning the result")
// have nothing to check against: they are not claims here, and are never
// counted, flagged or marked.
//
// The caller passes the chunks in, so `node --test` can exercise this against
// a hand-written fixture rather than the generated corpus.

import { isFenceLine, maskedText, splitBlocks } from "./answer-blocks.ts";

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

/**
 * Removes citation markers, leaving the prose a reader should see.
 *
 * Fenced lines are returned untouched: the space collapse below would eat a
 * code block's indentation, and a marker-shaped token inside a snippet is
 * code, not a citation.
 */
export function stripCitations(text: string): string {
  let inFence = false;
  return text
    .split("\n")
    .map((line) => {
      if (isFenceLine(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return (
        line
          .replace(MARKER, "")
          .replace(PARTIAL_MARKER, "")
          // A marker sits after the full stop, so removing it leaves a
          // doubled space.
          .replace(/[ \t]{2,}/g, " ")
          .replace(/[ \t]+$/, "")
      );
    })
    .join("\n");
}

/** Citation ids in a string, in order, without deduplication. */
export function citationIds(text: string): string[] {
  return [...text.matchAll(MARKER)].map((m) => m[1]!);
}

export type ClaimVerdict =
  /** Every number and proper noun in the sentence is in the chunk it cited. */
  | "verified"
  /**
   * The cited chunk lacks a token, but every missing token is in the record
   * under another chunk: the fact is real, the pointer is wrong. Usually a
   * sentence that joins two chunks and cites one.
   */
  | "miscited"
  /**
   * A number or name the record doesn't contain anywhere, or a citation to a
   * chunk that doesn't exist alongside a real one. The only verdict that gets
   * the strong mark.
   */
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
  /** Of `missing`, the tokens no chunk in the record contains. */
  absent: string[];
  /** Chunks, other than the cited ones, that hold a missing token. */
  elsewhere: string[];
  verdict: ClaimVerdict;
};

/**
 * One piece of text checked against the chunks it names. Shared by
 * `verifyAnswer` and the role-fit rows (lib/role-fit.ts), so a row gets the
 * same check as a sentence of prose.
 */
export type ClaimCheck = {
  ids: string[];
  unknownIds: string[];
  missing: string[];
  absent: string[];
  elsewhere: string[];
  /** False when there is no number and no proper noun to check. */
  checkable: boolean;
  verdict: ClaimVerdict;
};

// --- Where else a missing token lives ---------------------------------------
//
// The shell's lookup (ALL_CHUNKS_BY_ID, lib/corpus.ts) holds two corpora:
// Sidhant's record and this site's own source (`repo:` ids). A missing token is
// looked up only within its citations' corpus, so a fabricated number about
// Nokia is never excused because some line of TypeScript contains it.

const REPO_PREFIX = "repo:";

function corpusOf(id: string): "repo" | "record" {
  return id.startsWith(REPO_PREFIX) ? "repo" : "record";
}

/** Normalized chunk text, cached per lookup so a long answer normalizes once. */
const NORMALIZED = new WeakMap<Record<string, VerifiableChunk>, Map<string, string>>();

function normalizedChunks(lookup: Record<string, VerifiableChunk>): Map<string, string> {
  let cached = NORMALIZED.get(lookup);
  if (!cached) {
    cached = new Map(Object.values(lookup).map((c) => [c.id, normalize(c.text)]));
    NORMALIZED.set(lookup, cached);
  }
  return cached;
}

/**
 * Splits the tokens a cited chunk didn't contain into those found elsewhere in
 * the record (and where) and those found nowhere. Exported for the role-fit
 * rows, which carry their missing tokens rather than a Claim.
 */
export function locateMissing(
  missing: string[],
  ids: string[],
  lookup: Record<string, VerifiableChunk>,
): { absent: string[]; elsewhere: string[] } {
  if (!missing.length) return { absent: [], elsewhere: [] };
  const corpora = new Set(ids.map(corpusOf));
  const others = [...normalizedChunks(lookup)].filter(
    ([id]) => !ids.includes(id) && corpora.has(corpusOf(id)),
  );
  const absent: string[] = [];
  const elsewhere: string[] = [];
  for (const token of missing) {
    const holders = others.filter(([, text]) => present(token, text)).map(([id]) => id);
    if (!holders.length) absent.push(token);
    for (const id of holders) if (!elsewhere.includes(id)) elsewhere.push(id);
  }
  return { absent, elsewhere };
}

export function checkClaim(
  text: string,
  cited: string[],
  lookup: Record<string, VerifiableChunk>,
): ClaimCheck {
  const ids = cited.filter((id) => lookup[id]);
  const unknownIds = cited.filter((id) => !lookup[id]);
  const tokens = checkableTokens(text);

  if (!ids.length) {
    return {
      ids,
      unknownIds,
      missing: [],
      absent: [],
      elsewhere: [],
      checkable: tokens.length > 0,
      verdict: "uncited",
    };
  }
  const haystack = normalize(ids.map((id) => lookup[id]!.text).join("\n"));
  const missing = tokens.filter((t) => !present(t, haystack));
  const { absent, elsewhere } = locateMissing(missing, ids, lookup);
  // A citation to a chunk that doesn't exist is a fabricated source whatever
  // the tokens say, so it keeps the strong verdict even beside a real one.
  const verdict: ClaimVerdict =
    absent.length || unknownIds.length ? "unverified" : missing.length ? "miscited" : "verified";
  return {
    ids,
    unknownIds,
    missing,
    absent,
    elsewhere,
    checkable: tokens.length > 0,
    verdict,
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

// Capitalized words that name nothing: sentence openers, pronouns, grammar,
// and the discourse markers a model uses to list things ("First, he built…").
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

/** Digit runs: `2,100`, `4.96`, `20,000`, `2024`. */
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/** Capitalized words, keeping internal punctuation: `Power`, `B.S.`, `OXXO`. */
const NAME = /\b[A-Z][A-Za-z0-9&.'’/-]*/g;

/**
 * A clause that says what the record does not contain ("the key gaps are CPQ
 * and lead routing"). Every name in it is correctly absent from the corpus, so
 * checking it would mark a candid sentence as invented. An absence has nothing
 * to point at, the same reason an unmet row cites nothing.
 */
const ABSENCE = new RegExp(
  [
    String.raw`\b(?:does|did|do|has|have|had)(?:n['’]t| not)\b[^;]*?\b(?:show|establish|demonstrate|evidence|mention|include|cover|indicate|name|list|record)\w*`,
    String.raw`\b(?:hasn['’]t|haven['’]t|has not|have not)\s+(?:demonstrated|shown|done|worked|held|owned|used)\b`,
    String.raw`\b(?:key|main|central|core|biggest|remaining|other|real|clear)\s+gaps?\b`,
    String.raw`\bgaps?\s+(?:are|is|include|includes|would be)\b`,
    String.raw`\b(?:outside|beyond|not in|absent from|missing from)\s+(?:the|his)\s+record\b`,
    String.raw`\bno\s+(?:evidence|record|sign)\s+of\b`,
    String.raw`\bthe ramp would be\b`,
    String.raw`^\s*(?:but\s+)?not\b`,
  ].join("|"),
  "i",
);

/** Splits a sentence at the joints where a gap clause usually starts. */
const CLAUSE = /;|\s[—–]\s|,?\s+but\s+|,?\s+while\s+/i;

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
 * The parts of a sentence that can be checked against a source without a
 * model: its numbers and its proper nouns.
 */
export function checkableTokens(sentence: string): string[] {
  const text = plain(sentence);
  // A question asserts nothing ("Want to see how the payments work?").
  if (/\?\s*$/.test(text)) return [];
  // Only the clauses that assert something present are checked; a gap clause
  // is dropped and the rest of the sentence is still held to its sources, so
  // "Strong on Power BI at Nokia; the main gaps are CPQ" still checks Nokia.
  const asserted = text
    .split(CLAUSE)
    .filter((clause) => !ABSENCE.test(clause))
    .join(" ; ");
  const tokens: string[] = [];

  // The trailing comma of "in 2026, he shipped" is punctuation, not a digit.
  for (const match of asserted.matchAll(NUMBER)) tokens.push(match[0].replace(/,+$/, ""));

  for (const match of asserted.matchAll(NAME)) {
    const raw = match[0].replace(/[.,;:!?'’]+$/, "");
    if (raw.length < 2) continue;
    // A compound the answer joins and the corpus writes apart ("TypeScript/
    // Next.js", "Salesforce-to-Power"): each capitalized part is a name to
    // look for, and the lowercase parts assert nothing.
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
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Is this token findable in the cited text?
 *
 * Lenient about word endings and nothing else: "regions" against "region",
 * "Mexican" against "Mexico". An absence reported here becomes a mark on
 * screen, so a near-miss must never become an accusation, at the cost of
 * letting through a hallucination that shares a five-character stem.
 */
function present(token: string, haystack: string): boolean {
  const needle = normalize(token);
  // Numbers match exactly, never as digits inside a longer number ("20"
  // against "2024"): this decides whether a fabricated figure gets the strong
  // mark. `normalize` has already closed up thousands separators.
  if (/^\d/.test(needle)) {
    const escaped = needle.replace(/\./g, "\\.");
    return new RegExp(`(?<![\\d.])${escaped}(?!\\.?\\d)`).test(haystack);
  }
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

/** The `| --- | --- |` line under a table's header row. */
const TABLE_DELIMITER = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

/**
 * `| Role | Sales operations | Data science |` → `Sales operations, Data
 * science`: the row's cells as one checkable sentence, minus the first.
 *
 * The first cell is the row's label ("Users", "Stack"), a formatting word that
 * isn't in the corpus. A table whose first column holds data goes unchecked in
 * that column; accepted, because the prompt asks for tables that compare fields
 * across columns.
 */
function rowSentence(row: string): string {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .slice(1)
    .map((c) => c.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Splits a block into sentences, one list item per sentence at minimum.
 *
 * Deliberately simple. An over-eager split costs a claim its citation and shows
 * a false "uncited"; the abbreviation this corpus actually contains is `B.S.`,
 * which is handled by requiring a following space and capital.
 *
 * A table is split by row rather than exempted the way fences are, because a
 * row states facts. The header and delimiter rows state nothing and are
 * dropped, and so are the pipes.
 */
function sentencesOf(block: string): string[] {
  const lines = block.split("\n").filter((l) => l.trim());
  if (lines.length >= 2 && lines[0]!.includes("|") && TABLE_DELIMITER.test(lines[1]!)) {
    return lines.slice(2).map(rowSentence).filter(Boolean);
  }
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
 * A sentence with no marker of its own inherits its block's: models cite at
 * the end of a paragraph as often as at the end of a sentence.
 */
export function verifyAnswer(
  answer: string,
  lookup: Record<string, VerifiableChunk>,
): AnswerCheck {
  // The margin note is drawn against this block index, so the split must be
  // the renderer's own (lib/answer-blocks.ts). Masked, not stripped: see
  // maskedText.
  const rawBlocks = splitBlocks(answer).map(maskedText);
  const blocks: BlockCheck[] = [];
  const claims: Claim[] = [];
  const citedIds: string[] = [];
  const unknownIds: string[] = [];

  rawBlocks.forEach((block, index) => {
    const blockIds = citationIds(block);
    // Deduped because the margin keys its list by id; `citationIds` stays raw
    // for the per-sentence check.
    const blockValid = [...new Set(blockIds.filter((id) => lookup[id]))];
    const blockUnknown = [...new Set(blockIds.filter((id) => !lookup[id]))];

    for (const id of blockValid) if (!citedIds.includes(id)) citedIds.push(id);
    for (const id of blockUnknown) if (!unknownIds.includes(id)) unknownIds.push(id);

    let downgraded = 0;

    for (const sentence of sentencesOf(block)) {
      const own = citationIds(sentence);
      const text = stripCitations(sentence).trim();
      // `uncited` means no real chunk was cited for this sentence (nothing,
      // or only invented ids): either way there is no source to open.
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
        absent: check.absent,
        elsewhere: check.elsewhere,
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
