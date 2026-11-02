// Layer 1 — the citation checker, before and after (2026-11-02).
//
// evals/grader/checker-alarms.jsonl holds honest answers (recorded, pinned
// from live runs, and rebuilt from the bake-off's documented phrasings) and
// invented ones. evals/grader/recheck.mjs scores them with an earlier
// lib/verify.ts and with this one, offline, and writes
// evals/grader/checker-rescore.json. This file pins the "after": no honest
// answer marked, every invented one marked, and the committed re-score in
// step with the checker as it is.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { verifyAnswer } from "../lib/verify.ts";
import { read, readChunks } from "./lib/artifacts.mjs";
import { compareOnAlarmSet, loadAlarmSet, marks } from "./grader/checker.mjs";

const LOOKUP = Object.fromEntries(readChunks().map((c) => [c.id, c]));

describe("the checker's alarm set, after this change", () => {
  const rows = loadAlarmSet();
  const result = compareOnAlarmSet(rows, LOOKUP, verifyAnswer);

  test("no honest answer is marked", () => {
    const marked = result.perRow.filter((r) => r.honest && r.after.alarms).map((r) => `${r.id}: ${r.after.tokens}`);
    assert.deepEqual(marked, []);
  });

  test("every invented answer is", () => {
    const missed = result.perRow.filter((r) => !r.honest && !r.after.alarms).map((r) => r.id);
    assert.deepEqual(missed, []);
  });

  test("the published re-score agrees with the checker as it is", () => {
    const published = JSON.parse(read("evals/grader/checker-rescore.json"));
    assert.deepEqual(published.alarmSet.summary.honest.after, result.summary.honest.after);
    assert.deepEqual(published.alarmSet.summary.invented.after, result.summary.invented.after);
    for (const row of published.alarmSet.rows) {
      const now = result.perRow.find((r) => r.id === row.id);
      assert.ok(now, `${row.id} left the alarm set`);
      assert.equal(row.after.alarms, now.after.alarms, `${row.id}: re-run evals/grader/recheck.mjs`);
    }
  });

  test("an alarm is a loud mark, not a quiet one", () => {
    // Miscited is rendered quietly and is not an accusation, so it isn't
    // counted; unverified and uncited are.
    const m = marks(verifyAnswer, "He co-founded A Darle 20, which reached 2,100+ users. [resume:nokia]", LOOKUP);
    assert.equal(m.miscited, 1);
    assert.equal(m.alarms, 0);
  });
});
