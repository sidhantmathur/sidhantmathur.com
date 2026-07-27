// Recognising a pasted job description (roadmap Sprint 1, the JD fix).
//
// WHY THIS EXISTS
//
// Stage 0 of the job-description work (docs/idea-bank.md §6) found that on the
// postings Sidhant is LEAST qualified for, the model abandons the `roleFit`
// tool entirely and answers in prose. The prose is honest — it names the gaps —
// but there is no structured assessment behind it, so the feature silently
// degrades to a paragraph exactly when a recruiter most needs the verdict, and
// every downstream item (per-requirement rows, the scorecard, the export) has
// nothing to read from.
//
// The fix is to stop asking. The route forces the tool call on the first step
// of a job-posting turn instead of hoping the model chooses it. That requires
// knowing, server-side, that a turn IS a job posting.
//
// WHY IT'S A HEURISTIC AND NOT JUST THE PREFIX
//
// The paste-a-JD panel prefixes the posting with `JD_PREFIX`, so the prefix
// alone would cover the UI. It would not cover the eval harness, which posts
// postings raw, or a visitor who pastes into the normal input box — and a
// detector that only fires on the site's own affordance would mean the evals
// grade a path production doesn't take. So: prefix OR shape.
//
// Both halves are covered by evals/static.test.mjs against the real corpus.

/** Prepended by the paste-a-JD panel. Shared so the two can't drift. */
export const JD_PREFIX =
  "Here's a job description. Map my experience onto it, and be straight about where I don't match.";

/**
 * Shape signals. Any two, on a long enough message, is a posting.
 *
 * Tuned to be hard to trip by accident: a visitor asking "is he a fit for a
 * solutions engineering role?" hits none of these, and a long question about
 * his background hits at most one. The cost of a false positive is a forced
 * `roleFit` call on a turn that didn't need one; the cost of a false negative
 * is the bug this module exists to fix. The asymmetry is intentional.
 */
const SIGNALS: RegExp[] = [
  /^\s*requirements?\s*:/im,
  /^\s*(?:responsibilities|qualifications|what you'll do|about the role|nice to have|bonus)\s*:/im,
  /\b\d+\+?\s*years?\b/i,
  /\bwe(?:'re| are)\s+(?:looking|hiring|seeking)\b/i,
  /\byou'll\b/i,
  /\b(?:full[- ]time|part[- ]time|remote|hybrid|on-?site)\b/i,
  /\b(?:salary|compensation|benefits|equity)\s*(?:range|:)/i,
];

/** Below this, a message is a question about a role, not a posting. */
const MIN_POSTING_CHARS = 300;

export function looksLikeJobPosting(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.startsWith(JD_PREFIX)) return true;
  if (t.length < MIN_POSTING_CHARS) return false;
  let hits = 0;
  for (const signal of SIGNALS) {
    if (signal.test(t)) hits += 1;
    if (hits >= 2) return true;
  }
  return false;
}
