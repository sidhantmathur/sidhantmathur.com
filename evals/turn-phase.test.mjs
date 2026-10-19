// The phase line under a turn in flight: which step it names, and what the
// readout beside it shows.
//
// These run against lib/turn-phase.ts with hand-built messages in the shape
// the AI SDK assembles from the stream (a reasoning part with `state`, tool
// parts that go input-streaming → output-available, the route's `data-turn`
// frame). The stream they replay is the one measured on 2026-10-19: GPT-6
// Luna on a 2,500-character posting sends reasoning-start and reasoning-end
// with no text between them, and then streams the roleFit call's rows for
// most of ten seconds.
//
// The design rules from phase-line.tsx are asserted too: one line, the step and
// not the wait, nothing clickable.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  JD_CHECKING_PHASE,
  JD_READING_PHASE,
  JD_WRITING_PHASE,
  OPENING_PHASE,
  WRITING_PHASE,
  activityOf,
  formatActivity,
  isJobPostingTurn,
  phaseOf,
  sameActivity,
} from "../lib/turn-phase.ts";
import { JD_PREFIX } from "../lib/job-posting.ts";
import { read } from "./lib/artifacts.mjs";

const POSTING = `${JD_PREFIX}\n\nGTM Systems Manager. Own Salesforce administration, lead routing and CPQ.`;
const REQUIREMENTS = Array.from({ length: 14 }, (_, i) => `requirement ${i + 1}`);

const user = (text) => ({ role: "user", parts: [{ type: "text", text }] });
const assistant = (...parts) => ({ role: "assistant", parts });
const frame = (jobPosting) => ({ type: "data-turn", id: "turn", data: { jobPosting, usage: null, error: null } });
const reasoning = (state) => ({ type: "reasoning", text: "", state });
const extract = (state) => ({
  type: "tool-extractRequirements",
  state,
  input: { role: "GTM Systems Manager", requirements: REQUIREMENTS },
  ...(state === "output-available" ? { output: { role: "GTM Systems Manager", requirements: REQUIREMENTS } } : {}),
});
const fit = (state, rows = []) => ({
  type: "tool-roleFit",
  state,
  input: { role: "GTM Systems Manager", rows },
  ...(state === "output-available" ? { output: { rows, counts: {}, gaps: [] } } : {}),
});
const row = (i) => ({ requirement: REQUIREMENTS[i], verdict: "partial" });
const rows = (n) => Array.from({ length: n }, (_, i) => row(i));

/**
 * One job-posting turn, as the message looks after each chunk that changes it.
 * Every stretch of the measured stream is in here, in order.
 */
function jobPostingStream() {
  const head = [{ type: "step-start" }, frame(true)];
  const step1 = [...head, extract("output-available"), { type: "step-start" }];
  const states = [
    ["submitted", [user(POSTING)]],
    ["streaming", [user(POSTING), assistant(frame(true))]],
    ["streaming", [user(POSTING), assistant(...head, reasoning("streaming"))]],
    ["streaming", [user(POSTING), assistant(...head, reasoning("done"), extract("input-streaming"))]],
    ["streaming", [user(POSTING), assistant(...head, reasoning("done"), extract("output-available"))]],
    ["streaming", [user(POSTING), assistant(...step1)]],
    ["streaming", [user(POSTING), assistant(...step1, reasoning("streaming"))]],
    ["streaming", [user(POSTING), assistant(...step1, reasoning("done"))]],
  ];
  for (let n = 1; n <= 14; n++) {
    states.push(["streaming", [user(POSTING), assistant(...step1, reasoning("done"), fit("input-streaming", rows(n)))]]);
  }
  const step2 = [...step1, reasoning("done"), fit("output-available", rows(14)), { type: "step-start" }];
  states.push(["streaming", [user(POSTING), assistant(...step2)]]);
  states.push(["streaming", [user(POSTING), assistant(...step2, reasoning("streaming"))]]);
  states.push(["streaming", [user(POSTING), assistant(...step2, { type: "text", text: "Strong on" })]]);
  states.push(["ready", [user(POSTING), assistant(...step2, { type: "text", text: "Strong on reporting." })]]);
  return states;
}

describe("phaseOf on a pasted posting", () => {
  test("names the posting from the moment it is sent, before the stream opens", () => {
    assert.equal(phaseOf("submitted", [user(POSTING)]), JD_READING_PHASE);
    assert.equal(phaseOf("submitted", [user("What did he build at Nokia?")]), OPENING_PHASE);
  });

  test("the route's own frame decides, once it has arrived", () => {
    // The detector and the route agree by construction, but the frame is the
    // route's answer, and it wins when the two could differ.
    assert.equal(isJobPostingTurn([user(POSTING), assistant(frame(false))]), false);
    assert.equal(isJobPostingTurn([user("short"), assistant(frame(true))]), true);
  });

  test("walks the three steps in order, and only three", () => {
    const phases = jobPostingStream().map(([status, messages]) => phaseOf(status, messages));
    const distinct = phases.filter((p, i) => p !== phases[i - 1]);
    assert.deepEqual(distinct, [JD_READING_PHASE, JD_CHECKING_PHASE, JD_WRITING_PHASE, null]);
  });

  test("the reasoning between extraction and the first row belongs to the judging step", () => {
    // It used to read "writing the answer…": extraction had returned, so the
    // old reading saw a finished tool and assumed the model was composing.
    const [, , , , , , [status, messages]] = jobPostingStream();
    assert.equal(phaseOf(status, messages), JD_CHECKING_PHASE);
    assert.notEqual(phaseOf(status, messages), WRITING_PHASE);
  });
});

describe("phaseOf on an ordinary turn is unchanged", () => {
  const q = user("Tell me about A Darle 20");
  test("opening, a tool in flight, then composing", () => {
    assert.equal(phaseOf("submitted", [q]), OPENING_PHASE);
    assert.equal(phaseOf("streaming", [q, assistant(frame(false))]), OPENING_PHASE);
    assert.equal(
      phaseOf("streaming", [q, assistant(frame(false), { type: "tool-showProject", state: "input-streaming" })]),
      "pulling up the project…",
    );
    assert.equal(
      phaseOf("streaming", [q, assistant(frame(false), { type: "tool-showProject", state: "output-available", output: {} })]),
      WRITING_PHASE,
    );
  });

  test("goes away the moment there is prose, and when the turn is over", () => {
    assert.equal(phaseOf("streaming", [q, assistant({ type: "text", text: "He built" })]), null);
    assert.equal(phaseOf("ready", [q]), null);
    assert.equal(phaseOf("error", [q]), null);
  });
});

describe("activityOf: what the stream is doing inside the step", () => {
  test("shows hidden reasoning while a reasoning part is open, and only then", () => {
    const stream = jobPostingStream();
    const reasoningStates = stream.filter(([, m]) =>
      m.at(-1).parts.some((p) => p.type === "reasoning" && p.state === "streaming"),
    );
    assert.equal(reasoningStates.length, 3, "the fixture lost a reasoning stretch");
    for (const [status, messages] of reasoningStates) {
      assert.deepEqual(activityOf(status, messages), { kind: "reasoning" });
    }
    const closed = [user(POSTING), assistant(frame(true), reasoning("done"))];
    assert.equal(activityOf("streaming", closed), null);
  });

  test("counts the assessment's rows as they stream, out of the requirements extracted", () => {
    const counts = jobPostingStream()
      .map(([status, messages]) => activityOf(status, messages))
      .filter((a) => a?.kind === "rows")
      .map(formatActivity);
    assert.deepEqual(counts, Array.from({ length: 14 }, (_, i) => `${i + 1}/14`));
  });

  test("reads the alias the tool accepts, and never counts past the total", () => {
    const aliased = { type: "tool-roleFit", state: "input-streaming", input: { requirements: rows(20) } };
    const messages = [user(POSTING), assistant(frame(true), extract("output-available"), aliased)];
    assert.deepEqual(activityOf("streaming", messages), { kind: "rows", done: 14, total: 14 });
  });

  test("shows nothing it can't size, and nothing once the turn is over", () => {
    // A named-role question calls roleFit with no extraction behind it.
    const named = [user("Is he a fit for RevOps?"), assistant(frame(false), fit("input-streaming", rows(3)))];
    assert.equal(activityOf("streaming", named), null);
    for (const [status, messages] of jobPostingStream().slice(-2)) {
      assert.equal(activityOf(status, messages), null, `${status}: the readout outlived the line`);
    }
  });

  test("sameActivity tells a new reading from a repeat", () => {
    assert.ok(sameActivity(null, null));
    assert.ok(sameActivity({ kind: "reasoning" }, { kind: "reasoning" }));
    assert.ok(sameActivity({ kind: "rows", done: 3, total: 14 }, { kind: "rows", done: 3, total: 14 }));
    assert.ok(!sameActivity({ kind: "rows", done: 3, total: 14 }, { kind: "rows", done: 4, total: 14 }));
    assert.ok(!sameActivity({ kind: "reasoning" }, null));
    assert.ok(!sameActivity({ kind: "reasoning" }, { kind: "rows", done: 1, total: 14 }));
  });
});

describe("the phase line's design rules", () => {
  // phase-line.tsx and app-shell.tsx: one line, the step and not the wait,
  // nothing clickable.

  test("every step string is sentence case, one line, and reads as in progress", () => {
    for (const p of new Set(jobPostingStream().map(([s, m]) => phaseOf(s, m)).filter(Boolean))) {
      assert.ok(!p.includes("\n"), `"${p}" is not one line`);
      assert.equal(p, p.toLowerCase(), `"${p}" is not sentence case`);
      assert.ok(p.endsWith("…"), `"${p}" doesn't read as a step in progress`);
    }
  });

  test("every step, with its widest readout, fits on one line at 375px", () => {
    // Measured in the browser, 2026-10-19: the shell is Geist Mono, 9px a
    // character at the line's 15px and 8px at the readout's 13px. At 375px the
    // row is 343px: the grid (14) and three gaps (10, 10, 6), the elapsed count
    // (40), and once eight seconds have passed the stop button (32, after a
    // 12px gap). "checking 14 requirements…" failed this on its own.
    //
    // The reading step is held to the row WITHOUT the stop button: extraction
    // ended by 4.3 s in every measured run, and the button arrives at 8 s.
    const ROW = 343;
    const width = (label, readout, stop) =>
      14 + 10 + label.length * 9 + 10 + (readout ? readout.length * 8 + 6 : 0) + 40 + (stop ? 44 : 0);
    const widest = new Map();
    for (const [status, messages] of jobPostingStream()) {
      const p = phaseOf(status, messages);
      if (!p) continue;
      const a = activityOf(status, messages);
      const readout = a ? formatActivity(a) : "";
      if (readout.length >= (widest.get(p)?.length ?? 0)) widest.set(p, readout);
    }
    // The judging and writing steps can both run thinking, so price that in
    // even where the fixture's widest readout is a row count.
    for (const [p, readout] of widest) {
      const worst = readout.length > "thinking".length ? readout : "thinking";
      const stop = p !== JD_READING_PHASE;
      const w = width(p, worst, stop);
      assert.ok(w <= ROW, `"${p}" + "${worst}"${stop ? " + stop" : ""} is ${w}px, over the ${ROW}px row`);
    }
  });

  test("the step string never carries a count that changes inside the step", () => {
    // The shell keys the line by this string and announces it (aria-live). A
    // row count in it would replay the entry and the announcement every row.
    const phases = new Set(jobPostingStream().map(([s, m]) => phaseOf(s, m)));
    assert.ok(phases.size <= 4, `the phase string took ${phases.size} values across one turn`);
  });

  test("the readout is aria-hidden and nothing in the line is clickable", () => {
    const src = read("components/shell/phase-line.tsx");
    const markup = src.slice(src.indexOf("return ("));
    assert.ok(!/<button|onClick|href=/.test(markup), "the phase line grew something clickable");
    const cluster = markup.slice(markup.indexOf("{(activity"), markup.indexOf("</p>"));
    assert.ok(cluster.includes("formatActivity"), "the readout moved out of its cluster");
    assert.ok(cluster.includes("aria-hidden"), "the readout is announced — it changes every row");
  });

  test("the readout's words", () => {
    assert.equal(formatActivity({ kind: "reasoning" }), "thinking");
    assert.equal(formatActivity({ kind: "rows", done: 6, total: 14 }), "6/14");
  });
});
