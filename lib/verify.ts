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
// counted, flagged or marked. Nor is the part of a sentence that names what the
// record lacks ("the main gaps are CPQ and Gong"): those names are absent by
// design.
//
// It cannot see scope. "Built" for a tool he inherited, or "the systems" for
// one app, uses the same names and numbers as the true sentence and verifies.
// evals/grader/ measures that with a model, at eval time, never per request.
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
  options: TokenOptions = {},
): ClaimCheck {
  const ids = cited.filter((id) => lookup[id]);
  const unknownIds = cited.filter((id) => !lookup[id]);
  const tokens = checkableTokens(text, lookup, options);

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

/**
 * Common English words, in base form (`baseForms` undoes inflections). Used
 * for one decision: whether a capital the sentence's position explains
 * ("Strong SQL…") is also a name. Words that double as products or companies a
 * posting could name (power, teams, spark, outreach, slack, notion, looker,
 * square, mode, segment…) are left out on purpose, so they stay checkable.
 */
const COMMON_WORDS = new Set(
  `all any every many much several little less least lot lots none nothing
   nobody everything everyone everybody something someone somebody anything
   anyone anybody another others whatever whichever whoever wherever whenever
   thus hence therefore otherwise rather quite really almost nearly roughly
   approximately around above below beneath behind beside besides along
   alongside among against toward towards upon within off out up down away
   back through past near far outside inside except unless once whereas
   whilst myself himself herself itself ourselves themselves yourself yours
   ours theirs mine else ever never always often sometimes usually rarely
   seldom already soon now tomorrow yesterday tonight ago afterward afterwards
   moreover furthermore nonetheless nevertheless regardless accordingly
   consequently indeed anyway anyhow likewise alternatively conversely namely
   respectively perhaps maybe possibly probably likely unlikely certainly
   definitely surely clearly obviously apparently evidently presumably
   arguably admittedly honest frank candid simple mere further altogether
   entire full part partial large most main mainly primary chief especial
   particular notable significant substantial considerable slight somewhat fair
   pretty enough okay absolute exact precise direct indirect apart alone
   able actual additional adjacent advanced aggressive ample analytical annual
   applicable appropriate available average aware bad basic big bold brief broad
   busy capable careful central certain cheap clean clear close common
   comparable competitive complete complex comprehensive concrete confident
   consistent constant core correct credible critical crucial current daily
   dedicated deep demonstrable demonstrate dense detail different difficult
   distinct early easy effective efficient empty essential excellent existing
   expected experience explicit extensive external extra familiar fast fine firm
   final financial flat flexible focus foreign formal former frequent fresh
   functional fundamental future general genuine global good great half hand
   hard heavy high huge ideal immediate important impressive independent
   individual informal initial inner intense interesting internal junior key
   late lateral lean legitimate light limited local long loose low major manual
   material mature meaningful measurable medium mid middle minimal minor missing
   mixed modest monthly moderate multiple narrow natural near necessary negative
   net new nice nominal normal noticeable numerous obvious occasional official
   old open operational optional ordinary original outer own perfect personal
   plain plausible poor positive possible potential practical prefer present
   previous prior private probable productive professional proficient prominent
   proper proven public quarterly quick quiet rapid rare raw ready real
   realistic reasonable recent regional regular related relative relevant
   reliable remaining remote repeated required responsible rich right rigorous
   robust rough routine safe scalable scarce secondary secure senior separate
   serious sharp short similar single slow small smart solid sound special
   specific stable standard steady strategic strict strong structured
   successful sufficient suitable super supportive technical temporary thin
   thorough tight top total tough traditional transferable true typical
   ultimate unclear uncommon unique unknown unmet unrelated unusual upper urgent
   useful usual valid valuable various vast verified visible vital weak weekly
   whole wide worse worst wrong yearly young better best lower higher greater
   larger smaller bigger fewer
   ability access account accuracy action activity adoption advantage
   alignment analysis analyst analytics answer approach area aspect assessment
   assumption attention audience automation background balance base basis
   benefit budget business call candidate capability capacity career case cause
   caveat certification chance change choice claim client code collaboration
   combination comfort commitment communication company comparison competence
   concern condition confidence connection context contribution control cost
   coverage credit criteria culture customer cycle dashboard data date deadline
   deal decision degree delivery demand depth design development difference
   direction discussion domain draft effort emphasis end engagement engineering
   evidence example execution exercise expertise exposure extent fact factor
   feature feedback field figure finance fit forecast form foundation framework
   function gap goal governance ground group growth guess headcount help
   highlight history hour idea impact implementation importance improvement
   increase industry information infrastructure input insight instance
   integration intent interest interview issue item job judgment kind
   knowledge lack language leader leadership learning level life limit line
   list logic loop maintenance management manager market marketing match matter
   means measure method metric migration mind minute model moment month name
   nature need network number objective operation ops opportunity option order
   organization outcome output overview owner ownership pace partner pattern
   people percent performance period person perspective phase picture piece
   pipeline place plan platform point policy portion position practice
   preference presence pressure priority problem process product production
   profile program progress project proof proposal purpose quality quarter
   question range rate reason record reference region relationship report
   request requirement research resource response responsibility rest result
   revenue review risk role rollout room round rule sale sales scale scenario
   schedule scope score section sense sequence service set setup share side
   sign signal situation size skill solution source space speed stack stage
   stakeholder start state statement step story strategy strength structure
   style subject success summary supply support system table takeaway target
   task technology tenure term test thing time title tool tooling topic
   track training transition trend trust type understanding unit update usage
   use user value variety verdict version view volume way weakness week weight
   work workflow world year day decade morning evening night summer winter
   hundred thousand million billion dozen twice double triple
   accept achieve add address adjust adopt aim align allow analyze appear apply
   argue arrive assess assume attend avoid become begin believe belong bring
   build calculate carry catch check choose clarify collect combine compare
   compile connect consider consolidate contain continue contribute convert
   coordinate cover create cut decide define deliver depend deploy describe
   determine develop differ document drive earn eliminate enable ensure
   establish estimate evaluate exceed expand expect explain extend face fail
   fall fill find finish fix flag follow gain gather get give go grow handle
   happen hire hold identify implement improve include indicate inherit involve
   join know land launch lead learn leave lift live lose maintain make manage
   map mean meet merge migrate mention miss move offer operate pass pay perform
   pick play prepare prevent prioritize produce prove provide publish pull push
   put raise reach read receive reduce refer reflect relate release rely remain
   remove replace represent require resolve respond return run save say seem
   sell send serve settle shape ship show sit solve speak spend stand stay stop
   streamline suggest suit suppose talk teach tell tend train transfer
   translate treat try turn understand validate verify wait walk watch win
   write yield
   built ran led made gave given went gone took taken came saw seen said told
   knew known found held kept left lost met paid sent shown sold spent stood
   taught thought understood won wrote written brought bought began begun became
   chose chosen drew drawn drove driven fell fallen felt grew grown meant rose
   risen sat spoke spoken struck threw thrown broke broken caught dealt fought
   hid hit hung laid lent lit quit rode rang sang sank slid split spread stuck
   swept swung tore`
    .split(/\s+/)
    .filter(Boolean),
);

/** Inflections `baseForms` undoes: [suffix, what replaces it]. */
const INFLECTIONS: [string, string][] = [
  ["ies", "y"], ["ied", "y"], ["iest", "y"], ["ily", "y"], ["ally", ""],
  ["es", ""], ["s", ""], ["ed", ""], ["ing", ""], ["ly", ""], ["est", ""],
];

/** Candidate base forms: "matches" → match, "shipped" → ship, "used" → use. */
function baseForms(word: string): string[] {
  const out: string[] = [];
  for (const [suffix, replacement] of INFLECTIONS) {
    if (!word.endsWith(suffix)) continue;
    const stem = word.slice(0, -suffix.length);
    if (stem.length < 3) continue;
    out.push(stem + replacement);
    if (replacement) continue;
    out.push(`${stem}e`);
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0, -1));
  }
  return out;
}

function inVocabulary(word: string, vocabulary: Set<string>): boolean {
  return vocabulary.has(word) || baseForms(word).some((form) => vocabulary.has(form));
}

/** Digit runs: `2,100`, `4.96`, `20,000`, `2024`. */
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

/** Capitalized words, keeping internal punctuation: `Power`, `B.S.`, `OXXO`. */
const NAME = /\b[A-Z][A-Za-z0-9&.'’/-]*/g;

/** Every word, capitalized or not, in the same alphabet as NAME. */
const WORD = /[A-Za-z0-9][A-Za-z0-9&.'’/-]*/g;

/** What sits between two words when the second starts a sentence or label. */
const OPENING = /\n|[.!?:]["'”’)\]]*\s|\s[—–·|]\s/;

/**
 * Where a capital letter is explained by position: the first word of the
 * text, of a line, of a sentence the splitter left joined, after a colon, or
 * after a spaced dash. A list numeral ("1.") is markup, not the first word.
 */
function openingWords(text: string): Set<number> {
  const starts = new Set<number>();
  let previousEnd = 0;
  let opening = true;
  for (const match of text.matchAll(WORD)) {
    const word = match[0].replace(/[.'’/-]+$/, "");
    const index = match.index;
    const isOpening: boolean = opening || OPENING.test(text.slice(previousEnd, index));
    if (isOpening) starts.add(index);
    opening =
      isOpening && /^\d+$/.test(word) && /^[.)]\s/.test(text.slice(index + word.length));
    previousEnd = index + word.length;
  }
  return starts;
}

/**
 * What the record itself says about a word's case: `names` were written
 * capitalized somewhere a capital isn't explained by position ("built on
 * Glean"), `lower` were written lowercase (with their base forms). Only the
 * record counts: the site's source capitalizes identifiers, which says nothing
 * about English.
 */
type CaseEvidence = { names: Set<string>; lower: Set<string> };

const CASE_EVIDENCE = new WeakMap<Record<string, VerifiableChunk>, CaseEvidence>();

function caseEvidence(lookup: Record<string, VerifiableChunk>): CaseEvidence {
  const cached = CASE_EVIDENCE.get(lookup);
  if (cached) return cached;
  const names = new Set<string>();
  const lower = new Set<string>();
  for (const chunk of Object.values(lookup)) {
    if (corpusOf(chunk.id) === "repo") continue;
    const text = plain(chunk.text);
    const opening = openingWords(text);
    for (const match of text.matchAll(WORD)) {
      const parts = match[0].replace(/[.,;:!?'’]+$/, "").split(/[/-]/);
      parts.forEach((part, i) => {
        const key = normalize(part);
        if (!key) return;
        if (/^[a-z]/.test(part)) {
          lower.add(key);
          for (const form of baseForms(key)) lower.add(form);
        } else if (/^[A-Z]/.test(part) && !(i === 0 && opening.has(match.index))) {
          names.add(key);
        }
      });
    }
  }
  const evidence = { names, lower };
  CASE_EVIDENCE.set(lookup, evidence);
  return evidence;
}

/**
 * Is a capitalized word at the start of a sentence a name, or just the start
 * of the sentence? A name when its shape says so (CPQ, TypeScript, B2B, B.S.),
 * when the record writes it capitalized mid-sentence, or when nothing marks it
 * as an ordinary word. It is ordinary when it is a common English word or the
 * record writes it lowercase. The default is "name" on purpose: "Google hired
 * him" must still be checked, so an unknown word is a name until shown not to
 * be.
 */
function readsAsName(word: string, evidence?: CaseEvidence): boolean {
  if (/[A-Z].*[A-Z]|\d|[.&]/.test(word)) return true;
  const key = normalize(word);
  if (evidence?.names.has(key)) return true;
  if (inVocabulary(key, COMMON_WORDS)) return false;
  if (evidence && inVocabulary(key, evidence.lower)) return false;
  return true;
}

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

// --- Absences -------------------------------------------------------------
//
// A sentence that says what the record lacks ("the key gaps are CPQ and lead
// routing") names things correctly absent from every chunk, so checking them
// marks a candid sentence as invented. The checker finds what each absence is
// about (its object) and checks the rest of the sentence.
//
// The object is kept as small as the grammar allows, because nothing inside it
// is checked. It ends at a clause joint (;, a colon, a spaced dash, "but") and
// where a clause about him starts again ("…, and he led…"). A denied gap ("no
// gaps:", "isn't a gap") is a claim of coverage, not an absence.

/** What "the record" is called in an answer. */
const RECORD_NOUN = String.raw`(?:record|page|resume|corpus|knowledge\s+base)\b`;

/** Joints inside a sentence where one assertion ends and another can begin. */
const JOINT = new RegExp(
  [
    ";",
    String.raw`:\s`,
    // A full stop the sentence splitter left in ("none. 12 years…"), but not
    // the one in an abbreviation ("B.S. in").
    String.raw`(?<!\b[a-z])[.!?]\s`,
    String.raw`\s[—–]\s`,
    String.raw`,?\s+(?:but|while)\s+`,
    String.raw`,\s+(?:although|though|whereas)\s+`,
    String.raw`(?:,\s*|\s+)(?:and|or|so|plus)\s+(?=(?:he|she|it|they|sidhant)\b)`,
    String.raw`,\s*(?:and|so|plus)\s+(?=his\b(?!\s+${RECORD_NOUN}))`,
  ].join("|"),
  "gi",
);

type Segment = { start: number; end: number; afterColon: boolean };

function segmentsOf(text: string): Segment[] {
  const segments: Segment[] = [];
  let start = 0;
  let afterColon = false;
  for (const joint of text.matchAll(JOINT)) {
    segments.push({ start, end: joint.index, afterColon });
    start = joint.index + joint[0].length;
    afterColon = joint[0].startsWith(":");
  }
  segments.push({ start, end: text.length, afterColon });
  return segments;
}

const QUALIFIER = String.raw`(?:key|main|central|core|biggest|big|largest|major|real|clear|obvious|notable|significant|primary|principal|chief|remaining|other|open|outstanding|only|one|two|three|another)`;
const GAP = String.raw`(?:gaps?|unknowns?)`;
const LINK = String.raw`(?:\s+(?:are|is|include|includes|would\s+be|remains?))?`;
const NEGATION = String.raw`(?:(?:does|did|do|has|have|had)(?:n['’]t|\s+not|\s+never)|never)`;
const NOT_ONLY = String.raw`(?!\s+(?:only|just|merely|simply)\b)`;
const RECORD_VERB = String.raw`(?:show(?:s|n|ed|ing)?|establish(?:es|ed|ing)?|demonstrat(?:e|es|ed|ing)|evidenc(?:e|es|ed|ing)|mention(?:s|ed|ing)?|includ(?:e|es|ed|ing)|cover(?:s|ed|ing)?|indicat(?:e|es|ed|ing)|name(?:s|d)?|list(?:s|ed|ing)?|record(?:s|ed)?|document(?:s|ed)?|referenc(?:e|es|ed)|touch(?:es|ed)?|state(?:s|d)?|specif(?:y|ies|ied)|describ(?:e|es|ed)|support(?:s|ed)?|contain(?:s|ed)?|says?|said|cite(?:s|d)?|have|has|had|holds?|held|own(?:s|ed)?|possess(?:es|ed)?|use(?:s|d)?|runs?|ran|operat(?:e|es|ed)|manag(?:e|es|ed)|leads?|led|buil(?:t|d|ds)|administer(?:s|ed)?|configur(?:e|es|ed)|handl(?:e|es|ed)|work(?:s|ed)?|match(?:es|ed)?|meets?|met|fits?)`;
const RECORD = String.raw`(?:the|his|this)\s+${RECORD_NOUN}`;
const BE = String.raw`(?:is|are|was|were|remains?|stays?)`;
const ADVERB = String.raw`(?:\s+(?:also|still|both|entirely|currently|clearly))?`;

type Lead = { pattern: RegExp; deniable?: boolean };

/** The object follows: "the record does not show [CPQ or Gong]". */
const LEADS: Lead[] = [
  { pattern: new RegExp(String.raw`\b${NEGATION}\b${NOT_ONLY}(?:\s+[\w'’-]+){0,3}?\s+${RECORD_VERB}\b`, "gi") },
  { pattern: new RegExp(String.raw`\b${QUALIFIER}\s+${GAP}\b${LINK}`, "gi"), deniable: true },
  { pattern: new RegExp(String.raw`\b${GAP}\s+(?:are|is|include|includes|would\s+be|remain)\b`, "gi"), deniable: true },
  // A gap word ending its clause: "Gaps: …" labels what follows the colon.
  { pattern: new RegExp(String.raw`\b${GAP}\s*$`, "gi"), deniable: true },
  { pattern: /\bno\s+(?:evidence|record|sign|mention|indication|trace)\s+of\b/gi },
  { pattern: /\bno\s+(?:documented|recorded|listed|explicit|stated|demonstrated|evidenced|hands-on)\b/gi },
  { pattern: /\bthere(?:['’]s|\s+is|\s+are)\s+no\b(?!\s+(?:doubt|question)\b)/gi },
  { pattern: /\b(?:is|are)(?:n['’]t|\s+not)\s+any\b/gi },
  { pattern: /\bnothing\s+(?:touching|on|about|covering|involving|related\s+to|that\s+(?:touches|covers|shows|mentions))\b/gi },
  { pattern: /\b(?:is\s+silent\s+on|says\s+nothing\s+(?:about|on)|lacks|lacking)\b/gi },
  { pattern: /\bwhat(?:['’]s|\s+is)\s+missing\b/gi },
  { pattern: new RegExp(String.raw`\b(?:outside|beyond|absent\s+from|missing\s+from|not\s+(?:in|on))\s+${RECORD}\b`, "gi") },
  { pattern: /\bthe\s+ramp\s+would\s+be\b/gi },
  // At the start of a clause only: "…, but not Workato" and "Not Kubernetes."
  // count; "not only did he…" doesn't.
  { pattern: /^\s*not\b(?!\s+(?:only|just|merely|simply)\b)/gi },
];

/** The object comes first: "[Spark, Ray and Beam] are gaps". */
const TAILS: RegExp[] = [
  new RegExp(String.raw`\b${BE}${ADVERB}\s+(?:(?:a|an|the)\s+)?(?:${QUALIFIER}\s+)?${GAP}\b`, "gi"),
  new RegExp(String.raw`\b(?:${BE}|sits?|falls?|lies?)${ADVERB}\s+(?:outside|beyond|absent\s+from|missing\s+from|not\s+(?:in|on|part\s+of))\s+${RECORD}\b`, "gi"),
  new RegExp(String.raw`\b(?:is|are|was|were)(?:n['’]t|\s+not)${ADVERB}\s+(?:[\w-]+\s+)?(?:documented|established|shown|evidenced|demonstrated|covered|listed|mentioned|described|specified|stated|recorded|addressed|supported|confirmed|found)\b`, "gi"),
  new RegExp(String.raw`\b${BE}${ADVERB}\s+(?:missing|absent|unknown|undocumented|unproven|unevidenced|unmet|unaddressed|unestablished|unconfirmed)\b`, "gi"),
];

/** The object sits between: "no [HubSpot or Marketo] on the page". */
const BRACKET = new RegExp(
  String.raw`\bno\s+(.{1,120}?)\s+(?:on|in|anywhere\s+(?:on|in))\s+(?:the|his|this)\s+(?:page|record|resume|site|corpus|knowledge\s+base)\b`,
  "gi",
);

/** "no gaps", "no real gaps", "aren't any gaps": the gap word is denied. */
const DENIED = /\b(?:no|not|n['’]t|never|without|zero)\s+(?:[\w-]+\s+){0,2}$/i;

/**
 * Does the clause before a gap word make it something he acted on ("he
 * closed the gaps: …") rather than a label for what's missing? Having gaps
 * ("he has two gaps: …") is still a label.
 */
function actsOnGap(before: string): boolean {
  return (
    /\b(?:he|she|sidhant)\b/i.test(before) &&
    !/\b(?:he|she|sidhant)\s+(?:\w+\s+)?(?:has|have|had|faces|lacks)\b/i.test(before)
  );
}

/** A gap word that is denied, or that he acted on, labels no absence. */
function notALabel(before: string): boolean {
  return DENIED.test(before) || actsOnGap(before);
}

/** He, as a subject: where an object ends and a claim about him begins. */
const SUBJECT = /\b(?:he|she|sidhant)\b/gi;
/** "…doesn't show that he…": a subject inside the absence, not after it. */
const REPORTED = /\b(?:that|whether|if|how|where|when|what|which|who|whom|why)\s+(?:[\w'’-]+\s+)?$/i;
/**
 * A coordinated clause about him again: ", and Oracle hired him". "His
 * record" is where absences live, so it doesn't count.
 */
const ABOUT_HIM = new RegExp(
  String.raw`(?:,\s*|\s+)(?:and|or|so|plus)\s+(?=[^,;]*\b(?:he|him|she|her|sidhant|his(?!\s+${RECORD_NOUN}))\b)`,
  "i",
);

/** Where an object that starts at `from` ends, at most `to`. */
function objectEnd(text: string, from: number, to: number): number {
  const stretch = text.slice(from, to);
  let end = to;
  for (const subject of stretch.matchAll(SUBJECT)) {
    const at = from + subject.index;
    if (REPORTED.test(text.slice(Math.max(0, at - 40), at))) continue;
    end = at;
    break;
  }
  const joint = ABOUT_HIM.exec(stretch);
  if (joint) end = Math.min(end, from + joint.index);
  return end;
}

/**
 * Where the object of a tail ("… are gaps") starts, given the segment before
 * the tail. After the last clause that mentions him, if there is one: in "he
 * spent 12 years at Oracle and CPQ is a gap" the object is "CPQ".
 */
function objectStart(before: string): number {
  const mentions = [...before.matchAll(/\b(?:he|him|she|it|they|sidhant)\b/gi)];
  const last = mentions[mentions.length - 1];
  if (!last) return 0;
  const joint = /,\s*|\s(?:and|or)\s/i.exec(before.slice(last.index));
  return joint ? last.index + joint.index + joint[0].length : before.length;
}

type Span = [number, number];

/**
 * The stretches of `text` that name what the record lacks. `gapItem` marks a
 * list item under a gap heading ("Biggest gaps:"): an object from its first
 * word, though it doesn't say so itself.
 */
function absenceSpans(text: string, gapItem: boolean): Span[] {
  const spans: Span[] = [];
  let labelled = gapItem;
  segmentsOf(text).forEach((segment, i) => {
    const { start, end } = segment;
    const words = text.slice(start, end);
    if (labelled && (i === 0 || segment.afterColon)) {
      const from = start + (/^\s*(?:[-*+]|\d+[.)])?\s*/.exec(words)?.[0].length ?? 0);
      spans.push([from, objectEnd(text, from, end)]);
    }
    labelled = false;

    for (const { pattern, deniable } of LEADS) {
      for (const lead of words.matchAll(new RegExp(pattern.source, pattern.flags))) {
        if (deniable && notALabel(words.slice(0, lead.index))) continue;
        const from = start + lead.index + lead[0].length;
        // "Biggest gaps:" names its object after the colon.
        if (!/\w/.test(text.slice(from, end))) {
          labelled = true;
          continue;
        }
        spans.push([from, objectEnd(text, from, end)]);
      }
    }
    for (const pattern of TAILS) {
      for (const tail of words.matchAll(new RegExp(pattern.source, pattern.flags))) {
        spans.push([start + objectStart(words.slice(0, tail.index)), start + tail.index]);
      }
    }
    for (const bracket of words.matchAll(new RegExp(BRACKET.source, BRACKET.flags))) {
      const from = start + bracket.index + /^no\s+/i.exec(bracket[0])![0].length;
      spans.push([from, objectEnd(text, from, from + bracket[1]!.length)]);
    }
  });
  return spans;
}

/** Heading forms of a gap list: "Gaps", "The main gaps", "Where he doesn't match". */
const GAP_HEADING = new RegExp(
  [
    String.raw`(?:(?:the|his|some)\s+)?(?:${QUALIFIER}\s+)?${GAP}${LINK}`,
    String.raw`what(?:['’]s|\s+is)\s+missing`,
    String.raw`(?:outside|beyond|not\s+(?:in|on))\s+${RECORD}`,
    String.raw`where\s+(?:he|it)\s+(?:doesn['’]t|does\s+not|falls\s+short)\b[\w\s'’-]*`,
    String.raw`(?:the\s+record\s+)?${NEGATION}\s+${RECORD_VERB}`,
  ]
    .map((form) => `^(?:${form})$`)
    .join("|"),
  "i",
);

/**
 * Is this line the heading of a list of gaps ("Biggest gaps:", "**Where he
 * doesn't match**")? The items under it name absences without saying so.
 */
export function isGapHeading(sentence: string): boolean {
  const text = plain(sentence)
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/:$/, "")
    .trim();
  if (!text) return false;
  if (GAP_HEADING.test(text)) return true;
  // A lead-in sentence that ends at its colon: "There are three gaps:".
  if (!plain(sentence).trim().endsWith(":")) return false;
  const last = segmentsOf(text).pop()!;
  const words = text.slice(last.start, last.end);
  const tail = new RegExp(String.raw`\b${GAP}${LINK}$`, "i").exec(words);
  return !!tail && !notALabel(words.slice(0, tail.index));
}

/** List items: "- …", "* …", "1. …". */
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;

// --- Checkable tokens -----------------------------------------------------

export type TokenOptions = {
  /** The sentence is an item in a list under a gap heading. */
  gapItem?: boolean;
};

/**
 * The parts of a sentence that can be checked against a source without a
 * model: its numbers and its proper nouns. `lookup` is the record, which says
 * how its own words are capitalized; without it, only the built-in common-word
 * list decides whether a sentence's first word is a name.
 */
export function checkableTokens(
  sentence: string,
  lookup?: Record<string, VerifiableChunk>,
  options: TokenOptions = {},
): string[] {
  const text = plain(sentence);
  // A question asserts nothing ("Want to see how the payments work?").
  if (/\?\s*$/.test(text)) return [];
  const spans = absenceSpans(text, options.gapItem ?? false);
  const asserted = (index: number) => !spans.some(([from, to]) => index >= from && index < to);
  const opening = openingWords(text);
  const evidence = lookup ? caseEvidence(lookup) : undefined;
  const tokens: string[] = [];

  // The trailing comma of "in 2026, he shipped" is punctuation, not a digit.
  for (const match of text.matchAll(NUMBER)) {
    if (asserted(match.index)) tokens.push(match[0].replace(/,+$/, ""));
  }

  for (const match of text.matchAll(NAME)) {
    if (!asserted(match.index)) continue;
    const raw = match[0].replace(/[.,;:!?'’]+$/, "");
    if (raw.length < 2) continue;
    // A compound the answer joins and the corpus writes apart ("TypeScript/
    // Next.js", "Salesforce-to-Power"): each capitalized part is a name to
    // look for, and the lowercase parts assert nothing.
    raw.split(/[/-]/).forEach((part, i) => {
      if (part.length < 2 || !/^[A-Z]/.test(part)) return;
      if (STOPWORDS.has(normalize(part))) return;
      // "Strong SQL…": the capital is the sentence's, not the word's.
      if (i === 0 && opening.has(match.index) && !readsAsName(part, evidence)) return;
      tokens.push(part);
    });
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
 *
 * Each sentence says whether it opens and closes its line, which is how a list
 * item is told from the second sentence inside one.
 */
type Sentence = { text: string; opensLine: boolean; closesLine: boolean };

function sentencesOf(block: string): Sentence[] {
  const lines = block.split("\n").filter((l) => l.trim());
  if (lines.length >= 2 && lines[0]!.includes("|") && TABLE_DELIMITER.test(lines[1]!)) {
    return lines
      .slice(2)
      .map(rowSentence)
      .filter(Boolean)
      .map((text) => ({ text, opensLine: true, closesLine: true }));
  }
  return lines.flatMap((line) => {
    const parts = line
      .split(/(?<=[.!?])\s+(?=[A-Z[])/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.map((text, i) => ({
      text,
      opensLine: i === 0,
      closesLine: i === parts.length - 1,
    }));
  });
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
  // Inside a list that a gap heading ("Biggest gaps:") introduced. Survives a
  // blank line between the heading and its list; any other line ends it.
  let gapList = false;

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
      const own = citationIds(sentence.text);
      const text = stripCitations(sentence.text).trim();
      const item = sentence.opensLine && LIST_ITEM.test(text);
      if (sentence.opensLine && !item) gapList = false;
      // `uncited` means no real chunk was cited for this sentence (nothing,
      // or only invented ids): either way there is no source to open.
      const check = checkClaim(text, own.length ? own : blockIds, lookup, {
        gapItem: gapList && item,
      });
      if (sentence.closesLine && isGapHeading(text)) gapList = true;
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
