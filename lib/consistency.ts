// The consistent fit check. A pasted posting's requirements are extracted
// once, then assessed CONSISTENCY_SAMPLES times, independently and at the same
// time, and the table a reader sees is the per-row consensus. One run on its
// own moved between 5 and 7 unmet rows across three runs of one posting
// (docs/followups.md, "Reasoning on posting turns"), and the table is what a
// recruiter forwards, so a second run must not quietly say something else.
//
// How a row is settled:
//
//   1. Each assessment is reconciled on its own first (lib/role-fit.ts), so a
//      vote is what that assessment would have rendered alone: a claim with
//      no valid source votes `unclear`, and a requirement it skipped votes
//      `unclear` too.
//   2. Rows are matched to the extracted list by the posting's words, not by
//      position, so an assessment that reordered or dropped a row still lines
//      up. Position breaks ties between paraphrases.
//   3. A verdict more than half the assessments gave wins. With no majority,
//      or when one assessment says met and another unmet, the row is
//      `unclear`, the verdict the reconciler already falls back to, and it
//      carries no evidence: no single assessment's sentence speaks for it.
//   4. A source stays only when most of the assessments behind the winning
//      verdict cited it. The evidence sentence is the one, among theirs, that
//      the kept sources hold up best.
//   5. The merged table goes through the reconciler again, which has the last
//      word: citations re-checked, uncited claims downgraded, gaps kept
//      non-empty while a row is unmet.
//
// The split is recorded on the row (`agreement`) only where the assessments
// disagreed, as counts, never as a share: four tags already look more precise
// than the judgment under them (docs/idea-decisions.md §3).
//
// One assessment (CONSISTENCY_SAMPLES = 1, a named-role question with nothing
// extracted, or every extra one failing) is exactly reconcileRoleFit, field
// for field. The orchestration that runs the extra assessments is in
// lib/fit-samples.ts; this file has no dependency beyond lib/role-fit.ts and
// lib/verify.ts, so `node --test` loads it directly.

import {
  MAX_REQUIREMENT_CHARS,
  MAX_ROWS,
  VERDICTS,
  checkablePart,
  reconcileRoleFit,
  sameRequirement,
  type RawRoleFit,
  type RequirementRow,
  type RequirementVerdict,
  type RoleFitResult,
  type VerdictVotes,
} from "./role-fit.ts";
import { checkClaim, type VerifiableChunk } from "./verify.ts";
import type { TurnUsage } from "./chat-telemetry.ts";

/**
 * How many independent assessments a pasted posting's table is the consensus
 * of: the turn's own and CONSISTENCY_SAMPLES - 1 more. Odd, so two of them can
 * always outvote one. 1 is today's single assessment, exactly.
 */
export const CONSISTENCY_SAMPLES = 3;

/**
 * How long the card waits for the other assessments once the turn's own has
 * arrived. They start together, so a healthy one lands within seconds of it;
 * this bounds a stalled one. What arrives in time is merged, what doesn't is
 * stopped and billed at an upper bound.
 */
export const CONSISTENCY_GRACE_MS = 15_000;

/**
 * How often the route writes the progress part while it waits. The client's
 * stall watchdog (lib/chat-transport.ts) fails a stream that goes quiet for
 * 20 s, and a tool that is waiting writes nothing else.
 */
export const CONSISTENCY_HEARTBEAT_MS = 5_000;

// --- Settling one row ---------------------------------------------------------

function isPositive(v: RequirementVerdict): boolean {
  return v === "met" || v === "partial";
}

/**
 * Votes per verdict, only the verdicts that got one, in the table's verdict
 * order: the same votes always serialize the same way, whichever assessment
 * cast which.
 */
export function tally(votes: RequirementVerdict[]): VerdictVotes {
  const out: VerdictVotes = {};
  for (const v of VERDICTS) {
    const count = votes.filter((vote) => vote === v).length;
    if (count) out[v] = count;
  }
  return out;
}

function total(votes: VerdictVotes): number {
  return VERDICTS.reduce((sum, v) => sum + (votes[v] ?? 0), 0);
}

/**
 * The verdict a row's votes settle on. A strict majority wins, unless the
 * votes include both met and unmet: then the record reads both ways and the
 * row is unclear, whatever the count.
 */
export function consensusVerdict(votes: VerdictVotes): RequirementVerdict {
  const n = total(votes);
  const top = VERDICTS.find((v) => (votes[v] ?? 0) * 2 > n);
  const contested = (votes.met ?? 0) > 0 && (votes.unmet ?? 0) > 0;
  return top && !contested ? top : "unclear";
}

/**
 * Which row of one assessment answers which extracted requirement, one to one.
 * The posting's words first (the usual case: the model copies them), then a
 * paraphrase in the same position, then a paraphrase anywhere.
 */
function align(rows: RequirementRow[], requirements: string[]): (RequirementRow | null)[] {
  const out: (RequirementRow | null)[] = requirements.map(() => null);
  const used = new Set<number>();
  const take = (j: number, i: number) => {
    out[j] = rows[i]!;
    used.add(i);
  };
  const key = (text: string) => text.trim().toLowerCase();

  requirements.forEach((req, j) => {
    const i = rows.findIndex((r, k) => !used.has(k) && key(r.requirement) === key(req));
    if (i !== -1) take(j, i);
  });
  requirements.forEach((req, j) => {
    if (out[j] || used.has(j) || !rows[j]) return;
    if (sameRequirement(rows[j]!.requirement, req)) take(j, j);
  });
  requirements.forEach((req, j) => {
    if (out[j]) return;
    const i = rows.findIndex((r, k) => !used.has(k) && sameRequirement(r.requirement, req));
    if (i !== -1) take(j, i);
  });
  return out;
}

/** The posting's list as the table will hold it: trimmed, deduplicated, bounded. */
function canonical(extracted: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of extracted) {
    const text = typeof raw === "string" ? raw.trim().slice(0, MAX_REQUIREMENT_CHARS) : "";
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length >= MAX_ROWS) break;
  }
  return out;
}

function firstString(...values: unknown[]): string {
  for (const v of values) if (typeof v === "string" && v.trim()) return v;
  return "";
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

type SettledRow = {
  requirement: string;
  verdict: RequirementVerdict;
  evidence: string;
  sources: string[];
  /** The votes, when they weren't unanimous. */
  agreement: VerdictVotes | undefined;
  /** A positive majority with no source most of it cited. */
  unshared: boolean;
};

function settleRow(
  requirement: string,
  cast: (RequirementRow | null)[],
  lookup: Record<string, VerifiableChunk>,
): SettledRow {
  const n = cast.length;
  const votes = cast.map((row) => row?.verdict ?? "unclear");
  const counts = tally(votes);
  const verdict = consensusVerdict(counts);
  const agreement = counts[verdict] === n ? undefined : counts;

  // No majority behind what the row shows: a split. Nobody's sentence or
  // source speaks for the table, so it carries none.
  if ((counts[verdict] ?? 0) * 2 <= n) {
    return { requirement, verdict, evidence: "", sources: [], agreement, unshared: false };
  }

  const behind = cast.filter(
    (row, i): row is RequirementRow => votes[i] === verdict && row !== null,
  );
  const voters = counts[verdict] ?? 0;

  // A source most of the majority cited, in the order they first cited it.
  // Unknown ids count too, so one that most of them invented is still shown
  // and still flagged.
  const cited = new Map<string, number>();
  for (const row of behind) {
    for (const id of new Set([...row.sources, ...row.unknownSources])) {
      cited.set(id, (cited.get(id) ?? 0) + 1);
    }
  }
  const sources = [...cited].filter(([, c]) => c * 2 > voters).map(([id]) => id);

  // The sentence the kept sources hold up best; the earliest assessment on a
  // tie, which is the turn's own whenever it is in the majority.
  let evidence = "";
  let best = Infinity;
  for (const row of behind) {
    if (!row.evidence) continue;
    const missing = checkClaim(checkablePart(row.evidence, verdict), sources, lookup).missing.length;
    if (missing < best) {
      best = missing;
      evidence = row.evidence;
    }
  }

  return {
    requirement,
    verdict,
    evidence,
    sources,
    agreement,
    // Nothing at all in common. A shared id that doesn't exist is the
    // reconciler's to flag, as it would be on a single assessment.
    unshared: isPositive(verdict) && sources.length === 0,
  };
}

// --- The merge ------------------------------------------------------------------

/**
 * The consensus of several assessments of one extracted list, as the site
 * renders it. `samples[0]` is the turn's own assessment, the one the model
 * that writes the summary made; the rest are the extra ones, in launch order.
 */
export function mergeRoleFitSamples(
  samples: RawRoleFit[],
  extracted: string[],
  lookup: Record<string, VerifiableChunk>,
): RoleFitResult {
  const own = samples[0] ?? {};
  const requirements = canonical(extracted);
  // One assessment, or nothing to line several up against (a named role
  // rather than a posting): today's reconciliation, untouched.
  if (samples.length <= 1 || requirements.length === 0) {
    return reconcileRoleFit(own, extracted, lookup);
  }

  const judged = samples.map((s) => reconcileRoleFit(s ?? {}, requirements, lookup));
  const aligned = judged.map((j) => align(j.rows, requirements));
  const settled = requirements.map((req, j) =>
    settleRow(
      req,
      aligned.map((a) => a[j] ?? null),
      lookup,
    ),
  );

  // The verdict line and gaps are free text, so they can't be voted on. They
  // come from the assessment that agrees with the consensus on the most rows,
  // the turn's own on a tie.
  let rep = 0;
  let repAgrees = -1;
  aligned.forEach((rows, i) => {
    const agrees = settled.filter((s, j) => (rows[j]?.verdict ?? "unclear") === s.verdict).length;
    if (agrees > repAgrees) {
      rep = i;
      repAgrees = agrees;
    }
  });
  const chosen = samples[rep] ?? {};
  const order = [chosen, ...samples.filter((_, i) => i !== rep)];

  // Its gaps, plus any requirement the consensus left unmet that they don't
  // already name, so "what he doesn't have" never omits an unmet row. Nothing
  // is removed: leniency runs toward naming more gaps, not fewer.
  const gaps = strings(chosen.gaps);
  if (gaps.length) {
    for (const row of settled) {
      if (row.verdict !== "unmet") continue;
      if (!gaps.some((gap) => sameRequirement(gap, row.requirement))) gaps.push(row.requirement);
    }
  }

  const merged = reconcileRoleFit(
    {
      role: firstString(...order.map((s) => s?.role)),
      rows: settled.map(({ requirement, verdict, evidence, sources }) => ({
        requirement,
        verdict,
        evidence,
        sources,
      })),
      verdict: firstString(...order.map((s) => s?.verdict)),
      gaps,
      noGapsRationale: chosen.noGapsRationale,
    },
    requirements,
    lookup,
  );

  const rows = merged.rows.map((row, j) => {
    const s = settled[j];
    if (!s || row.requirement !== s.requirement) return row;
    let out: RequirementRow = row;
    // The reconciler reads a positive row with no kept source as uncited. It
    // did cite; the assessments just didn't cite the same thing.
    if (s.unshared && row.downgrade === "uncited") out = { ...out, downgrade: "unshared" };
    if (s.agreement) out = { ...out, agreement: s.agreement };
    return out;
  });

  return { ...merged, rows, samples: samples.length };
}

// --- Reading a row's agreement back -------------------------------------------

/** What a row's votes say, for the line beside it. Counts, never a share. */
export type Agreement =
  | { kind: "majority"; count: number; of: number }
  | { kind: "split"; votes: [RequirementVerdict, number][]; of: number };

/** Above this, a vote count didn't come from this site. */
const MAX_SAMPLES_SHOWN = 15;

/**
 * The agreement worth showing on a row, or null when there is none to show:
 * the assessments agreed, the table was assessed once, or the field is not
 * one this site would write. It arrives from a permalink too, so it is read
 * defensively.
 */
export function agreementOf(
  row: Pick<RequirementRow, "verdict" | "claimedVerdict" | "agreement">,
): Agreement | null {
  const raw = row.agreement;
  if (!raw || typeof raw !== "object") return null;
  const votes: [RequirementVerdict, number][] = [];
  for (const v of VERDICTS) {
    const c = (raw as Record<string, unknown>)[v];
    if (typeof c === "number" && Number.isInteger(c) && c > 0) votes.push([v, c]);
  }
  const of = votes.reduce((sum, [, c]) => sum + c, 0);
  if (of < 2 || of > MAX_SAMPLES_SHOWN) return null;
  // A row the reconciler downgraded after the vote still shows the vote for
  // the verdict it was settled on.
  const shown = row.claimedVerdict ?? row.verdict;
  const count = votes.find(([v]) => v === shown)?.[1] ?? 0;
  if (count === of) return null;
  if (count * 2 > of) return { kind: "majority", count, of };
  return { kind: "split", votes, of };
}

/**
 * The tool result as the model that writes the summary reads it: the merged
 * table without the vote bookkeeping, which is for the reader and would only
 * invite a sentence about the machinery. A single assessment has none, so it
 * is the SDK's default output exactly.
 */
export function forModel(result: RoleFitResult): unknown {
  const value = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
  delete value.samples;
  if (Array.isArray(value.rows)) {
    for (const row of value.rows as Record<string, unknown>[]) delete row.agreement;
  }
  return value;
}

// --- What the extra assessments cost -------------------------------------------

function plus(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

/** Two usage records as one. A field is null only when both are. */
export function addUsage(a: TurnUsage | null, b: TurnUsage | null): TurnUsage | null {
  if (!a) return b;
  if (!b) return a;
  return {
    inputTokens: plus(a.inputTokens, b.inputTokens),
    cachedInputTokens: plus(a.cachedInputTokens, b.cachedInputTokens),
    cacheWriteTokens: plus(a.cacheWriteTokens, b.cacheWriteTokens),
    outputTokens: plus(a.outputTokens, b.outputTokens),
    reasoningTokens: plus(a.reasoningTokens, b.reasoningTokens),
    totalTokens: plus(a.totalTokens, b.totalTokens),
  };
}

/**
 * What an extra assessment whose usage never came back is counted as: the
 * judging step's whole prompt, uncached, and the whole output ceiling. It was
 * the same prompt as the turn's own judging step, and it can't have written
 * more than the ceiling, so this is at or above anything it billed. Input is
 * counted as cache writes when the model prices those above fresh input, so
 * the bound holds whichever way the provider billed it.
 */
export function usageCeiling(
  promptTokens: number | null,
  maxOutputTokens: number,
  price: { input: number; cacheWrite: number } | undefined,
): TurnUsage {
  const input = promptTokens ?? 0;
  const writes = price && price.cacheWrite > price.input ? input : 0;
  return {
    inputTokens: input,
    cachedInputTokens: 0,
    cacheWriteTokens: writes,
    outputTokens: maxOutputTokens,
    reasoningTokens: null,
    totalTokens: input + maxOutputTokens,
  };
}

/**
 * The extra assessments' usage, summed: what each reported, or the ceiling
 * for one that never reported. The cost meter reads this inside the turn's
 * usage, so it can read high and never low.
 */
export function extraUsage(
  reported: (TurnUsage | null)[],
  ceiling: TurnUsage,
): { usage: TurnUsage | null; estimated: number } {
  let usage: TurnUsage | null = null;
  let estimated = 0;
  for (const u of reported) {
    if (!u) estimated += 1;
    usage = addUsage(usage, u ?? ceiling);
  }
  return { usage, estimated };
}
