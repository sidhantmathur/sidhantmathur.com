// The job-description assessment, reconciled after the model produces it. The
// model extracts a posting's requirements in one step and judges them in the
// next; this module runs after both and decides what a reader sees:
//
//   1. Every extracted requirement gets a row. One the judgment skipped is
//      added as `unclear`, so coverage doesn't depend on the model's diligence.
//   2. A `met` or `partial` row that cites nothing valid is downgraded to
//      `unclear`, and the reason is recorded next to it.
//   3. A row that does cite has its evidence run through the citation checker
//      (lib/verify.ts), the same standard as a sentence of prose.
//   4. Gaps can't come out empty while an `unmet` row exists: if the model
//      supplies none, they are derived from the rows.
//
// Only a positive verdict needs a citation. `unmet` and `unclear` assert an
// absence, which has no chunk to point at; demanding one would make claiming a
// fit the cheapest way to satisfy the checker.
//
// The invariants are enforced here rather than in the Zod schema because a
// rejected tool call is a broken turn with no assessment at all. The schema
// stays generous, and the worst case here is a downgraded row.
//
// Dependency-free apart from lib/verify.ts (the caller passes the corpus in),
// so `node --test` can run it against hand-written fixtures.

import { checkClaim, type VerifiableChunk } from "./verify.ts";

export type RequirementVerdict = "met" | "partial" | "unmet" | "unclear";

const VERDICTS: RequirementVerdict[] = ["met", "partial", "unmet", "unclear"];

/** A verdict that asserts something Sidhant has, and so has to cite it. */
function isPositive(v: RequirementVerdict): boolean {
  return v === "met" || v === "partial";
}

/** The tool's raw input, before any of this module has run. */
export type RawRoleFit = {
  role?: unknown;
  /**
   * The assessment's rows. `requirements` is the same list under the name the
   * model sometimes slips into; the route's schema accepts both.
   */
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

// Bounds. A table longer than MAX_ROWS stops being readable, and the generation
// that fills it stops fitting the output ceiling.
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
// The checker reads presence: whether a sentence's numbers and names appear in
// the chunk it cited. A row stating a shortfall names things that are absent by
// construction ("SQL and DAX at Nokia, but no dbt or Snowflake"), so checking it
// whole would mark the most honest rows unverified.
//
// So a `met` row is checked whole, a `partial` row up to its first negation
// (where the claim ends and the shortfall begins), and `unmet` and `unclear`
// rows not at all.

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
 * Is this row about that requirement? Leans toward matching: a false match
 * means a requirement answered once instead of twice, while a false miss adds a
 * duplicate "not covered" row right under the row that covered it.
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
 * `extracted` is the verbatim requirement list from the extraction step. It is
 * empty when the turn named a role rather than pasting a posting, and then
 * coverage adds no rows.
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
    // A bare string is what a model produces when it echoes the extraction
    // instead of judging it. It is kept as a visibly unjudged row: a
    // requirement with no verdict is worth more than a lost assessment.
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
      // The downgrade: a positive claim with no valid source renders as unclear.
      verdict: uncited ? "unclear" : claimed,
      claimedVerdict: uncited ? claimed : null,
      downgrade: uncited ? "uncited" : null,
      evidence,
      sources: check.ids,
      unknownSources: check.unknownIds,
      // A cited row whose numbers and names aren't in the chunk keeps its
      // verdict and gets the mark instead: the checker reports absence, and
      // rewriting a verdict on a near-miss would be an accusation, not a report.
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

  // Gaps are the model's or, if it supplied none, the posting's own words for
  // every unmet row. No path returns unmet rows with no gaps.
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
