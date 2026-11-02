// What the grader reads: the calibration set, the frozen corpora it cites,
// and (optionally) the claims of a live run.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "../lib/artifacts.mjs";
import { LABELS } from "./prompt.mjs";

export const CALIBRATION = "evals/grader/calibration.jsonl";

/** JSON Lines, blank lines skipped. A bad line names itself. */
export function readJsonl(text, name = "input") {
  return text.split("\n").flatMap((line, i) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line)];
    } catch (error) {
      throw new Error(`${name}:${i + 1}: ${error.message}`);
    }
  });
}

const corpora = new Map();

/**
 * A frozen corpus, `evals/grader/corpus/<revision>.json`. Frozen because a
 * label is only true of the text it was judged against: if the record changes,
 * a row's ground truth must not change with it.
 */
export function loadCorpus(revision, root = ROOT) {
  const key = `${root}:${revision}`;
  if (!corpora.has(key)) {
    const file = join(root, "evals", "grader", "corpus", `${revision}.json`);
    corpora.set(key, JSON.parse(readFileSync(file, "utf8")).chunks);
  }
  return corpora.get(key);
}

/** Problems with one calibration row, as strings; empty when it is sound. */
export function rowProblems(row, chunks) {
  const problems = [];
  if (!row.id) problems.push("no id");
  if (!row.claim?.trim()) problems.push("no claim");
  if (!LABELS.includes(row.label)) problems.push(`label "${row.label}" is not one of ${LABELS.join(", ")}`);
  if (!row.kind) problems.push("no kind");
  if (typeof row.synthetic !== "boolean") problems.push("synthetic is not true or false");
  if (row.synthetic !== (row.kind === "synthetic")) problems.push("synthetic and kind disagree");
  if (!row.provenance || typeof row.provenance !== "object") problems.push("no provenance");
  if (!row.chunks?.length) problems.push("cites no chunk");
  for (const id of row.chunks ?? []) if (!chunks?.[id]) problems.push(`chunk ${id} is not in corpus ${row.corpus}`);
  return problems;
}

/** The calibration set, each row with its sources' text resolved. */
export function loadCalibration(path = CALIBRATION, root = ROOT) {
  const rows = readJsonl(readFileSync(join(root, path), "utf8"), path);
  return rows.map((row) => {
    const chunks = loadCorpus(row.corpus, root);
    const problems = rowProblems(row, chunks);
    if (problems.length) throw new Error(`${path}, row ${row.id ?? "?"}: ${problems.join("; ")}`);
    return { ...row, sources: row.chunks.map((id) => ({ id, text: chunks[id] })) };
  });
}

/**
 * The claims of a live run (evals/results.json) that lib/verify.ts verified.
 * Those are the grader's real job: a verified claim has its numbers and names
 * in its source, and only scope can still be wrong. No ground truth, so no
 * label.
 */
export function liveRows(run, lookup, verifyAnswer) {
  const rows = [];
  for (const result of run.results ?? []) {
    if (!result.answer) continue;
    const check = verifyAnswer(result.answer, lookup);
    check.claims
      .filter((claim) => claim.verdict === "verified")
      .forEach((claim, i) => {
        rows.push({
          id: `${result.id}#${i + 1}`,
          claim: claim.text,
          label: null,
          kind: `live:${result.group ?? "unknown"}`,
          sources: claim.ids.map((id) => ({ id, text: lookup[id].text })),
        });
      });
  }
  return rows;
}
