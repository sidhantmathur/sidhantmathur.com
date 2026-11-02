// The grading loop: one claim at a time, each call priced at its worst case
// before it is allowed to start (see budget.mjs).

import { estimateTokens, usageUsd, worstCaseUsd } from "./budget.mjs";
import { parseVerdict } from "./parse.mjs";
import { SYSTEM, userMessage } from "./prompt.mjs";

/** Consecutive failed calls before the run gives up: a bad key fails every one. */
export const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Grades `rows` with `judge` under `budget`. Returns the per-row results, the
 * id of the first row the cap stopped (or null), and why the run ended early,
 * if it did.
 */
export async function gradeRows(rows, { judge, price, budget, maxOutputTokens, onResult }) {
  const results = [];
  let stoppedAt = null;
  let abortedBy = null;
  let failures = 0;

  for (const row of rows) {
    const prompt = userMessage(row);
    const worst = worstCaseUsd(price, estimateTokens(SYSTEM + prompt), maxOutputTokens);
    if (!budget.allows(worst)) {
      stoppedAt = row.id;
      break;
    }

    let reply = null;
    let callError = null;
    try {
      reply = await judge({ id: row.id, instructions: SYSTEM, prompt, row });
    } catch (error) {
      callError = error?.message ?? String(error);
    }
    // A call that failed may still have billed, so it is charged its worst
    // case; so is one whose provider reported no usage.
    const costUsd = reply ? (usageUsd(price, reply.usage) ?? worst) : worst;
    budget.charge(costUsd);

    const verdict = reply
      ? parseVerdict(reply.text)
      : { label: null, reason: "", error: `call failed: ${callError}` };
    const result = {
      id: row.id,
      kind: row.kind ?? null,
      truth: row.label ?? null,
      predicted: verdict.label,
      reason: verdict.reason,
      error: verdict.error,
      usage: reply?.usage ?? null,
      costUsd,
    };
    results.push(result);
    onResult?.(result, row);

    failures = callError ? failures + 1 : 0;
    if (failures >= MAX_CONSECUTIVE_FAILURES) {
      abortedBy = callError;
      break;
    }
  }

  return { results, stoppedAt, abortedBy, spentUsd: budget.spentUsd };
}

/**
 * The whole run's cost before it starts. `worstUsd` is what the cap reserves
 * (input at three characters a token, the full output ceiling). `expectedUsd`
 * is the likely bill: four characters a token, and `expectedOutputTokens` of
 * output, which is a one-line JSON reply plus some reasoning.
 */
export function projectCost(rows, { price, maxOutputTokens, expectedOutputTokens = 200 }) {
  let expected = 0;
  let worst = 0;
  let inputTokens = 0;
  for (const row of rows) {
    const text = SYSTEM + userMessage(row);
    const likely = Math.ceil(text.length / 4);
    inputTokens += likely;
    worst += worstCaseUsd(price, estimateTokens(text), maxOutputTokens);
    expected += worstCaseUsd(price, likely, expectedOutputTokens);
  }
  return { inputTokens, expectedUsd: expected, worstUsd: worst };
}
