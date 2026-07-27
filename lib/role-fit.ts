// The job-description assessment, made honest after the fact (roadmap Sprint 4:
// S1 / bank §6 Stage 1, and the schema half of #11's `requirementTable`).
//
// WHERE THE JUDGMENT LIVES
//
// The model extracts the posting's requirements in one step and judges them in
// the next. This module runs after both and is the only thing that decides what
// a reader finally sees:
//
//   1. Every extracted requirement gets a row. One the judgment skipped is
//      added as `unclear`, so coverage is a property of the code rather than of
//      the model's diligence. Sprints 1 and 3 both ended with the same failing
//      assertion — an honest assessment that quietly skipped one labeled
//      requirement — and this is the structural fix for it.
//   2. A row claiming a fit (`met` / `partial`) that cites nothing valid is
//      downgraded to `unclear`. Not flagged, not softened: the verdict changes,
//      and the reason for the change is recorded next to it.
//   3. A row that DOES cite gets Sprint 3's checker run over its evidence, so a
//      row's sentence is held to the same standard as a sentence of prose.
//   4. Gaps cannot come out empty while an `unmet` row exists — if the model
//      supplies none, they are derived from the rows themselves.
//
// WHY A CITATION IS ONLY REQUIRED OF A POSITIVE CLAIM
//
// `unmet` and `unclear` are assertions about ABSENCE, and an absence has no
// chunk to point at. Demanding a source for them would make the cheapest way to
// satisfy the checker "claim it instead", which is the exact failure this whole
// sprint exists to make structurally hard.
//
// WHY IT RUNS HERE AND NOT IN THE SCHEMA
//
// Zod could reject a bad assessment, but a rejected tool call is a broken turn,
// and Sprint 1 established that a broken turn reads exactly like the bug being
// fixed. Validation that can throw the answer away is a failure path. So the
// schema stays generous and the invariants are enforced on the far side of it,
// where the worst case is a downgraded row rather than no assessment at all.
//
// Dependency-free apart from lib/verify (the caller passes the corpus in), so
// `node --test` can exercise it against hand-written fixtures. Same reasoning as
// lib/verify.ts and lib/transcript.ts.

import { checkClaim, type VerifiableChunk } from "./verify.ts";

export type RequirementVerdict = "met" | "partial" | "unmet" | "unclear";

const VERDICTS: RequirementVerdict[] = ["met", "partial", "unmet", "unclear"];

/** A verdict that asserts something Sidhant HAS, and so has to point at it. */
function isPositive(v: RequirementVerdict): boolean {
  return v === "met" || v === "partial";
}

/** The tool's raw input, before any of this module has run. */
export type RawRoleFit = {
  role?: unknown;
  /** The assessment's rows. `requirements` is read too, for older shapes. */
  rows?: unknown;
  requirements?: unknown;
  gaps?: unknown;
  noGapsRationale?: unknown;
  verdict?: unknown;
};

export type RequirementRow = {
  /** The posting's words, not the site's. */
  requirement: string;
  /** What the reader sees — after any downgrade below. */
  verdict: RequirementVerdict;
  /** What the model tagged it, when code changed the answer. */
  claimedVerdict: RequirementVerdict | null;
  /** Why code changed it. */
  downgrade: "uncited" | "uncovered" | "unjudged" | null;
  evidence: string;
  /** Cited ids that exist in the corpus. */
  sources: string[];
  /** Cited ids that don't. A fabricated id is a fabricated source. */
  unknownSources: string[];
  /** Checkable tokens the cited chunks don't contain. Empty when it holds up. */
  unverified: string[];
};

export type RoleFitResult = {
  role: string;
  rows: RequirementRow[];
  counts: Record<RequirementVerdict, number>;
  gaps: string[];
  /** Only set when there are genuinely no gaps — the model's reason, in its words. */
  noGapsRationale: string | null;
  /** One-line headline. Null when the model didn't write one. */
  verdict: string | null;
  /** Rows added by coverage: the assessment never mentioned them. */
  uncovered: number;
  /** Rows whose verdict was changed by this module. */
  downgraded: number;
};

// Bounds. A posting with forty bullet points is a posting with forty bullet
// points, but a table that long stops being readable and the generation that
// fills it stops fitting the output ceiling.
const MAX_ROWS = 14;
const MAX_REQUIREMENT_CHARS = 240;
const MAX_EVIDENCE_CHARS = 400;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function strList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => str(v, max)).filter(Boolean);
}

function toVerdict(value: unknown): RequirementVerdict {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (VERDICTS as string[]).includes(v) ? (v as RequirementVerdict) : "unclear";
}

// --- What part of a row's sentence is checkable ---------------------------
//
// Sprint 3's checker reads PRESENCE: it asks whether a sentence's numbers and
// names appear in the chunk it cited. On a row that states a shortfall, the
// names in the sentence are the things deliberately NOT in the record — "he
// owns SQL and DAX at Nokia, but there is no dbt, Snowflake, or BigQuery in the
// knowledge base" is an honest sentence whose last three names are absent by
// construction. Checking it whole put an unverified mark on the most honest
// rows in the table, which is precisely the failure Sprint 3 spent its
// calibration on: a mark on a correct sentence teaches the reader to ignore
// every mark.
//
// So: a `met` row is checked whole. A `partial` row is checked up to its first
// negation, which is where the claim ends and the shortfall begins. `unmet` and
// `unclear` rows are not checked at all — they assert an absence, and this
// checker has nothing to say about absences.

const NEGATION = /\b(?:but|though|although|however|while|whereas|no|not|none|nothing|never|lacks?|lacking|missing|absent|without|doesn'?t|does not|didn'?t|isn'?t|is not|aren'?t|hasn'?t|has not|haven'?t)\b/i;

/** The part of a row's evidence a presence check can fairly read. */
export function checkablePart(evidence: string, verdict: RequirementVerdict): string {
  if (verdict === "met") return evidence;
  if (verdict !== "partial") return "";
  const match = NEGATION.exec(evidence);
  return match ? evidence.slice(0, match.index) : evidence;
}

// --- Matching a row to an extracted requirement ---------------------------

const MATCH_STOPWORDS = new Set(
  `a an the and or of to for in on with at by as is are be you your our we they
   experience years year plus strong deep comfortable ability able must should
   have has had own owning owned work working build building using use used
   including e.g. etc bonus nice preferred required plus+`
    .split(/\s+/)
    .filter(Boolean),
);

/** Content words, lowercased. The comparison unit for coverage matching. */
function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.]+|[.]+$/g, ""))
    .filter((w) => w.length > 1 && !MATCH_STOPWORDS.has(w));
}

/**
 * Is this row about that requirement?
 *
 * Deliberately generous: the cost of a false match is a requirement the reader
 * sees answered once instead of twice, and the cost of a false MISS is a
 * duplicate row saying "the assessment didn't cover this" directly underneath
 * the place it covered it. The second is the one that makes the table look
 * broken, so the threshold leans toward matching.
 */
export function sameRequirement(a: string, b: string): boolean {
  const left = contentWords(a);
  const right = contentWords(b);
  if (!left.length || !right.length) return false;
  const smaller = left.length <= right.length ? left : right;
  const larger = new Set(left.length <= right.length ? right : left);
  const shared = smaller.filter((w) => larger.has(w)).length;
  return shared / smaller.length >= 0.5;
}

// --- The reconciliation ---------------------------------------------------

/**
 * Turns what the model produced into what the site will render.
 *
 * `extracted` is the verbatim requirement list from the extraction step, empty
 * when the turn was a question about a role rather than a pasted posting —
 * there is nothing to extract from a question, so coverage simply doesn't
 * apply and no rows are added.
 */
export function reconcileRoleFit(
  raw: RawRoleFit,
  extracted: string[],
  lookup: Record<string, VerifiableChunk>,
): RoleFitResult {
  const source = Array.isArray(raw.rows) ? raw.rows : raw.requirements;
  const rawRows = Array.isArray(source) ? source : [];

  const rows: RequirementRow[] = [];
  for (const entry of rawRows.slice(0, MAX_ROWS)) {
    // A bare string is the shape a model falls into when it echoes the
    // extraction instead of judging it — the failure that cost this sprint's
    // first live run four of six postings, back when the schema rejected it
    // and the whole assessment went with it. It is kept, and it is kept
    // VISIBLY unjudged: a requirement with no verdict is worth more to a
    // reader than a turn with no assessment, and worth less than a verdict.
    if (typeof entry === "string") {
      const requirement = str(entry, MAX_REQUIREMENT_CHARS);
      if (!requirement) continue;
      rows.push({
        requirement,
        verdict: "unclear",
        claimedVerdict: null,
        downgrade: "unjudged",
        evidence: "",
        sources: [],
        unknownSources: [],
        unverified: [],
      });
      continue;
    }
    const r = (entry ?? {}) as Record<string, unknown>;
    const requirement = str(r.requirement, MAX_REQUIREMENT_CHARS);
    if (!requirement) continue;

    const claimed = toVerdict(r.verdict);
    const evidence = str(r.evidence, MAX_EVIDENCE_CHARS);
    const cited = strList(r.sources, 80);
    const check = checkClaim(checkablePart(evidence, claimed), cited, lookup);

    const uncited = isPositive(claimed) && check.ids.length === 0;

    rows.push({
      requirement,
      // THE DOWNGRADE. A claim with no source to open is not a claim the site
      // is willing to render as one.
      verdict: uncited ? "unclear" : claimed,
      claimedVerdict: uncited ? claimed : null,
      downgrade: uncited ? "uncited" : null,
      evidence,
      sources: check.ids,
      unknownSources: check.unknownIds,
      // A cited row whose numbers and names aren't in the chunk keeps its
      // verdict and gets the mark instead. Sprint 3's leniency runs one way for
      // a reason (its note 3): the checker reports absence, and a near-miss
      // that silently rewrote a verdict would be an accusation, not a report.
      unverified: check.ids.length ? check.missing : [],
    });
  }

  // Coverage. Anything the posting asked for that no row is about.
  let uncovered = 0;
  for (const requirement of extracted) {
    const text = str(requirement, MAX_REQUIREMENT_CHARS);
    if (!text) continue;
    if (rows.some((row) => sameRequirement(row.requirement, text))) continue;
    if (rows.length >= MAX_ROWS) break;
    uncovered += 1;
    rows.push({
      requirement: text,
      verdict: "unclear",
      claimedVerdict: null,
      downgrade: "uncovered",
      evidence: "",
      sources: [],
      unknownSources: [],
      unverified: [],
    });
  }

  const counts: Record<RequirementVerdict, number> = {
    met: 0,
    partial: 0,
    unmet: 0,
    unclear: 0,
  };
  for (const row of rows) counts[row.verdict] += 1;

  // Gaps. The model's, or — if it supplied none while the table says otherwise
  // — the posting's own words for every requirement it does not meet. There is
  // no path here that produces an assessment with unmet rows and no gaps.
  let gaps = strList(raw.gaps, MAX_EVIDENCE_CHARS);
  if (!gaps.length) gaps = rows.filter((r) => r.verdict === "unmet").map((r) => r.requirement);

  const rationale = str(raw.noGapsRationale, MAX_EVIDENCE_CHARS);

  return {
    role: str(raw.role, 120),
    rows,
    counts,
    gaps,
    // A rationale for having no gaps is only meaningful when there are none.
    noGapsRationale: !gaps.length && rationale ? rationale : null,
    verdict: str(raw.verdict, MAX_EVIDENCE_CHARS) || null,
    uncovered,
    downgraded: rows.filter((r) => r.downgrade !== null).length,
  };
}
