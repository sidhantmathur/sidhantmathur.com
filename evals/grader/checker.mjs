// Re-scoring answers with a version of lib/verify.ts, so a change to the
// checker can be measured on the same answers before and after it. Offline:
// no model, no network.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "../lib/artifacts.mjs";
import { readJsonl } from "./rows.mjs";

export const ALARM_SET = "evals/grader/checker-alarms.jsonl";

/** The marks a reader sees as an accusation: not found anywhere, or no source. */
export const LOUD = ["unverified", "uncited"];

/** An answer's assistant prose from a recorded conversation fixture. */
function fixtureAnswer(path, root) {
  const recorded = JSON.parse(readFileSync(join(root, path), "utf8"));
  return recorded.messages
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.parts.filter((p) => p.type === "text").map((p) => p.text))
    .join("\n\n");
}

/** The alarm set, each row with its answer text resolved. */
export function loadAlarmSet(path = ALARM_SET, root = ROOT) {
  return readJsonl(readFileSync(join(root, path), "utf8"), path).map((row) => ({
    ...row,
    answer: row.fixture ? fixtureAnswer(row.fixture, root) : row.answer,
  }));
}

/** How one checker marked one answer: verdict counts, and the loud marks. */
export function marks(verifyAnswer, answer, lookup) {
  const check = verifyAnswer(answer, lookup);
  const counts = { verified: 0, miscited: 0, unverified: 0, uncited: 0 };
  for (const claim of check.claims) counts[claim.verdict] += 1;
  const loud = check.claims.filter((c) => LOUD.includes(c.verdict));
  return {
    claims: check.claims.length,
    ...counts,
    alarms: loud.length,
    tokens: loud.flatMap((c) => (c.absent.length ? c.absent : c.missing.length ? c.missing : ["(no source)"])),
  };
}

/** Totals over a list of `marks` results. */
export function total(results) {
  const sum = { answers: results.length, claims: 0, verified: 0, miscited: 0, unverified: 0, uncited: 0, alarms: 0, answersWithAlarms: 0 };
  for (const r of results) {
    for (const key of ["claims", "verified", "miscited", "unverified", "uncited", "alarms"]) sum[key] += r[key];
    if (r.alarms) sum.answersWithAlarms += 1;
  }
  return sum;
}

/**
 * The alarm set through two checkers. `before` may be null, to describe one
 * checker alone. Honest rows' alarms are false alarms; invented rows' alarms
 * are the checker doing its job.
 */
export function compareOnAlarmSet(rows, lookup, after, before = null) {
  const perRow = rows.map((row) => ({
    id: row.id,
    honest: row.honest,
    class: row.class,
    reconstructed: !!row.reconstructed,
    after: marks(after, row.answer, lookup),
    before: before ? marks(before, row.answer, lookup) : null,
  }));
  const side = (key, honest) => {
    const subset = perRow.filter((r) => r.honest === honest && r[key]);
    return subset.length ? { rows: subset.length, flagged: subset.filter((r) => r[key].alarms).length } : null;
  };
  return {
    perRow,
    summary: {
      honest: { before: side("before", true), after: side("after", true) },
      invented: { before: side("before", false), after: side("after", false) },
    },
  };
}
