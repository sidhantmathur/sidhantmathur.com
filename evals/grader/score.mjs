// Calibration math. Every rate is a count first: a precision of 1.0 over one
// prediction is not the same finding as 1.0 over forty, so the counts travel
// with the ratios, and a ratio with nothing under it is null, never 0 or 1.

import { LABELS } from "./prompt.mjs";

/** What scope inflation and plain invention have in common: a claim to fix. */
export const PROBLEM_LABELS = ["overstated", "unsupported"];

/**
 * Precision and recall for one positive class (a label, or a set of labels).
 * `rows` are `{ truth, predicted }`; a `predicted` of null is an unparsed
 * reply, which can only ever count against recall.
 */
export function precisionRecall(rows, positive) {
  const isPositive = (label) =>
    Array.isArray(positive) ? positive.includes(label) : label === positive;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const { truth, predicted } of rows) {
    const actual = isPositive(truth);
    const said = predicted != null && isPositive(predicted);
    if (actual && said) tp++;
    else if (!actual && said) fp++;
    else if (actual && !said) fn++;
    else tn++;
  }
  const ratio = (num, den) => (den ? num / den : null);
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  const f1 = precision != null && recall != null && precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : null;
  return { tp, fp, fn, tn, support: tp + fn, predicted: tp + fp, precision, recall, f1 };
}

/** truth → predicted → count, with "unparsed" for a null prediction. */
export function confusion(rows) {
  const columns = [...LABELS, "unparsed"];
  const matrix = Object.fromEntries(
    LABELS.map((t) => [t, Object.fromEntries(columns.map((p) => [p, 0]))]),
  );
  for (const { truth, predicted } of rows) {
    if (!matrix[truth]) continue;
    matrix[truth][predicted ?? "unparsed"] += 1;
  }
  return matrix;
}

/**
 * Everything the runner reports about a labelled run. Rows without a `truth`
 * (live claims, which have no ground truth) are left out of the math and
 * counted as `unlabelled`.
 */
export function scoreRun(results) {
  const labelled = results.filter((r) => LABELS.includes(r.truth));
  const parsed = labelled.filter((r) => r.predicted != null);
  const correct = labelled.filter((r) => r.predicted === r.truth).length;
  const byKind = {};
  for (const r of labelled) {
    const kind = r.kind ?? "unknown";
    byKind[kind] ??= { n: 0, correct: 0 };
    byKind[kind].n += 1;
    if (r.predicted === r.truth) byKind[kind].correct += 1;
  }
  return {
    n: labelled.length,
    unlabelled: results.length - labelled.length,
    parsed: parsed.length,
    accuracy: labelled.length ? correct / labelled.length : null,
    overstated: precisionRecall(labelled, "overstated"),
    problem: precisionRecall(labelled, PROBLEM_LABELS),
    byLabel: Object.fromEntries(LABELS.map((l) => [l, precisionRecall(labelled, l)])),
    byKind,
    confusion: confusion(labelled),
  };
}

/** "0.83 (10/12)", or "n/a (0/0)" when there is nothing to divide. */
export function formatRate(value, num, den) {
  return `${value == null ? "n/a" : value.toFixed(2)} (${num}/${den})`;
}
