// Re-scores answers with the checker as it is and as it was, offline.
//
//   node --experimental-strip-types evals/grader/recheck.mjs \
//     --before /tmp/before/lib/verify.ts --before-name 24d3770 \
//     [--results evals/results.json ...] [--out evals/grader/checker-rescore.json]
//
// `--before` is an older lib/verify.ts with its sibling answer-blocks.ts, for
// example:
//
//   mkdir -p /tmp/before/lib
//   git show 24d3770:lib/verify.ts > /tmp/before/lib/verify.ts
//   git show 24d3770:lib/answer-blocks.ts > /tmp/before/lib/answer-blocks.ts
//
// Always scores the alarm set (evals/grader/checker-alarms.jsonl). Each
// `--results` file is a live run's evals/results.json, which keeps the
// answers; evals/published/latest.json doesn't, by design, so a published run
// can only be re-scored from the results file it was published from.
//
// The output holds ids, counts and flagged tokens, never answer text.

import { writeFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { verifyAnswer as after } from "../../lib/verify.ts";
import { ROOT, read, readChunks } from "../lib/artifacts.mjs";
import { compareOnAlarmSet, loadAlarmSet, marks, total } from "./checker.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : null;
};
const all = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]] : []));

const beforePath = flag("before");
const before = beforePath
  ? (await import(pathToFileURL(isAbsolute(beforePath) ? beforePath : resolve(beforePath)).href)).verifyAnswer
  : null;
const lookup = Object.fromEntries(readChunks().map((c) => [c.id, c]));

const alarmSet = compareOnAlarmSet(loadAlarmSet(), lookup, after, before);
const describe = (s) => (s ? `${s.flagged} of ${s.rows}` : "—");
console.log("\n  Alarm set (evals/grader/checker-alarms.jsonl)");
console.log(`    honest answers marked:   before ${describe(alarmSet.summary.honest.before)}, after ${describe(alarmSet.summary.honest.after)}`);
console.log(`    invented answers marked: before ${describe(alarmSet.summary.invented.before)}, after ${describe(alarmSet.summary.invented.after)}`);
for (const row of alarmSet.perRow) {
  const b = row.before ? `${row.before.alarms}` : "—";
  console.log(`      ${row.honest ? "honest  " : "invented"} ${row.id}: alarms ${b} → ${row.after.alarms}`);
}

const live = all("results").map((file) => {
  const run = JSON.parse(read(file));
  const answers = (run.results ?? []).filter((r) => r.answer && !r.broke);
  const scored = (checker) => total(answers.map((r) => marks(checker, r.answer, lookup)));
  const result = { file, model: run.model ?? null, startedAt: run.startedAt ?? null, after: scored(after), before: before ? scored(before) : null };
  console.log(`\n  ${file} (${result.model ?? "unknown model"})`);
  for (const key of ["claims", "verified", "miscited", "unverified", "uncited"]) {
    console.log(`    ${key.padEnd(10)} ${result.before ? result.before[key] : "—"} → ${result.after[key]}`);
  }
  return result;
});

const out = flag("out");
if (out) {
  writeFileSync(
    join(ROOT, out),
    JSON.stringify(
      {
        note: "Offline re-score of lib/verify.ts: ids, counts and the tokens each loud mark reported. No answer text; the answers live in the inputs named here.",
        before: beforePath ? `lib/verify.ts at ${flag("before-name") ?? "an earlier revision"}` : null,
        after: "lib/verify.ts as committed with this file",
        alarmSet: { summary: alarmSet.summary, rows: alarmSet.perRow },
        live,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\n  Wrote ${out}`);
}
console.log("");
