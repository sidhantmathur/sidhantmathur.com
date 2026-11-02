// The consistent fit check's merge, checked without a model.
//
// A posting's requirements are extracted once and assessed several times;
// lib/consistency.ts settles each row on the assessments' consensus and hands
// the result to the reconciler (lib/role-fit.ts), which still has the last
// word. Everything a recruiter would notice changing between two runs is
// decided here, by code, so it is all testable offline: the vote, what a split
// becomes, which citations survive, which sentence speaks for a row, and that
// one assessment is exactly today's table.
//
// Fixtures, not the real corpus, for the reason evals/role-fit.test.mjs gives.
// The route that runs the assessments is tested in
// evals/consistency-route.test.mjs.

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import "./lib/ts-paths.mjs";
import {
  CONSISTENCY_GRACE_MS,
  CONSISTENCY_HEARTBEAT_MS,
  CONSISTENCY_SAMPLES,
  addUsage,
  agreementOf,
  consensusVerdict,
  extraUsage,
  forModel,
  mergeRoleFitSamples,
  tally,
  usageCeiling,
} from "../lib/consistency.ts";
import { reconcileRoleFit } from "../lib/role-fit.ts";
import { costOfTurn, MODEL_PRICES } from "../lib/pricing.ts";
import { DEFAULT_MODEL } from "../lib/models.ts";
import { read } from "./lib/artifacts.mjs";

const { FIT_CONSENSUS, agreementCount, agreementNote } = await import("../components/shell/shell-data.ts");

const CHUNKS = {
  "resume:nokia": {
    id: "resume:nokia",
    text: "Resume — Nokia\nMigrated sales reporting from Salesforce Analytics to Power BI for 150+ users, with data modeling in SQL and DAX.",
  },
  "nokia:quarter-end-close": {
    id: "nokia:quarter-end-close",
    text: "Quarter-end close\nBuilt a Power App that replaced the manual quarter-end reporting collection across 7 regions.",
  },
  "resume:a-darle-20": {
    id: "resume:a-darle-20",
    text: "Resume — A Darle 20\nBuilt the platform as sole developer. Reached 2,100+ users and 110+ hosts.",
  },
};

const REQS = [
  "Strong SQL",
  "Power BI dashboards for leadership",
  "Quarter-end close reporting",
  "Salesforce CPQ administration",
];

const row = (requirement, verdict, evidence = "", sources = []) => ({
  requirement,
  verdict,
  evidence,
  sources,
});

/** One assessment, shaped like the model's roleFit input. */
function assessment(rows, extra = {}) {
  return {
    role: "RevOps analyst",
    rows,
    verdict: "Strong on reporting; the ramp would be CPQ.",
    gaps: ["Salesforce CPQ administration"],
    ...extra,
  };
}

/** The four requirements, with one row's verdict and sources swapped in. */
function withRow(index, replacement) {
  const base = [
    row(REQS[0], "met", "SQL and DAX modeling at Nokia.", ["resume:nokia"]),
    row(REQS[1], "met", "Moved reporting to Power BI for 150+ users.", ["resume:nokia"]),
    row(REQS[2], "partial", "Built a Power App for quarter-end collection.", ["nokia:quarter-end-close"]),
    row(REQS[3], "unmet", "The record shows no CPQ work."),
  ];
  base[index] = replacement;
  return assessment(base);
}

const merge = (samples, extracted = REQS) => mergeRoleFitSamples(samples, extracted, CHUNKS);
const rowFor = (result, requirement) => result.rows.find((r) => r.requirement === requirement);

// --- One assessment ---------------------------------------------------------

describe("one assessment is today's table, exactly", () => {
  const shapes = [
    withRow(0, row(REQS[0], "met", "SQL daily.", [])), // uncited, downgraded
    assessment([row(REQS[1], "met", "Power BI for 150+ users.", ["resume:nokia"])]), // three uncovered
    assessment([REQS[0], REQS[1]]), // bare strings: unjudged
    assessment([], { gaps: [] }), // empty
    { role: 42, rows: "garbage" }, // garbage
    withRow(1, row(REQS[1], "met", "Tableau for 900 users.", ["resume:nokia", "resume:invented"])),
  ];

  test("N = 1: the merge is reconcileRoleFit, field for field and key for key", () => {
    for (const raw of shapes) {
      const expected = reconcileRoleFit(raw, REQS, CHUNKS);
      const actual = merge([raw]);
      assert.deepEqual(actual, expected);
      assert.equal(JSON.stringify(actual), JSON.stringify(expected), "same keys, same order");
      assert.ok(!("samples" in actual), "a single assessment says nothing about samples");
      assert.ok(actual.rows.every((r) => !("agreement" in r)));
    }
  });

  test("several assessments with nothing extracted (a named role) fall back to the turn's own", () => {
    const own = withRow(0, row(REQS[0], "partial", "Some SQL.", ["resume:nokia"]));
    const other = withRow(0, row(REQS[0], "unmet", "No SQL."));
    assert.deepEqual(merge([own, other, other], []), reconcileRoleFit(own, [], CHUNKS));
  });

  test("no assessment at all is an empty table, not a crash", () => {
    assert.deepEqual(merge([]), reconcileRoleFit({}, REQS, CHUNKS));
  });

  test("the sample count is one odd constant, and the waits are bounded", () => {
    assert.ok(Number.isInteger(CONSISTENCY_SAMPLES) && CONSISTENCY_SAMPLES >= 1);
    assert.equal(CONSISTENCY_SAMPLES % 2, 1, "an even count can tie two against two");
    // The client's stall watchdog fails a stream that is quiet for 20 s.
    assert.ok(CONSISTENCY_HEARTBEAT_MS < 20_000, "the heartbeat is slower than the stall watchdog");
    // Inside the route's 90 s maxDuration, with room for the summary after it.
    assert.ok(CONSISTENCY_GRACE_MS > 0 && CONSISTENCY_GRACE_MS <= 30_000);
  });
});

// --- The vote ---------------------------------------------------------------

describe("settling a row", () => {
  test("the verdict rule, on its own", () => {
    const cases = [
      [["met", "met", "met"], "met"],
      [["met", "met", "partial"], "met"],
      [["partial", "partial", "met"], "partial"],
      [["partial", "unmet", "unmet"], "unmet"],
      [["unclear", "unclear", "met"], "unclear"],
      [["met", "partial", "unclear"], "unclear"], // no majority
      [["met", "partial", "unmet"], "unclear"], // no majority, and met against unmet
      [["met", "met", "unmet"], "unclear"], // a majority, but met against unmet
      [["met", "unmet"], "unclear"],
      [["met", "partial"], "unclear"], // two assessments that differ have no majority
      [["met", "met", "met", "partial", "unmet"], "unclear"],
      [["met", "met", "met", "partial", "partial"], "met"],
    ];
    for (const [votes, expected] of cases) {
      assert.equal(consensusVerdict(tally(votes)), expected, votes.join(", "));
    }
  });

  test("the same votes serialize the same way, whoever cast them", () => {
    const a = JSON.stringify(tally(["unmet", "met", "partial"]));
    const b = JSON.stringify(tally(["partial", "unmet", "met"]));
    assert.equal(a, b);
    assert.equal(a, JSON.stringify({ met: 1, partial: 1, unmet: 1 }));
  });

  test("unanimous: the row is the row, and nothing is said about agreement", () => {
    const a = withRow(3, row(REQS[3], "unmet", "No CPQ."));
    const out = merge([a, a, a]);
    assert.equal(out.samples, 3);
    assert.deepEqual(
      out.rows.map((r) => r.verdict),
      ["met", "met", "partial", "unmet"],
    );
    assert.ok(out.rows.every((r) => r.agreement === undefined), "a unanimous row carries no count");
    assert.ok(out.rows.every((r) => agreementOf(r) === null));
    assert.deepEqual(out.counts, { met: 2, partial: 1, unmet: 1, unclear: 0 });
  });

  test("2–1: the majority's verdict, and the split recorded", () => {
    const out = merge([
      withRow(0, row(REQS[0], "met", "SQL and DAX at Nokia.", ["resume:nokia"])),
      withRow(0, row(REQS[0], "partial", "Some SQL at Nokia.", ["resume:nokia"])),
      withRow(0, row(REQS[0], "met", "SQL and DAX modeling.", ["resume:nokia"])),
    ]);
    const sql = rowFor(out, REQS[0]);
    assert.equal(sql.verdict, "met");
    assert.deepEqual(sql.agreement, { met: 2, partial: 1 });
    assert.deepEqual(agreementOf(sql), { kind: "majority", count: 2, of: 3 });
    assert.equal(agreementNote(agreementOf(sql)), "2 of 3 agree");
    // Only the row they differed on says so.
    assert.equal(out.rows.filter((r) => r.agreement).length, 1);
  });

  test("2–1 the other way round", () => {
    const out = merge([
      withRow(2, row(REQS[2], "met", "Built the Power App.", ["nokia:quarter-end-close"])),
      withRow(2, row(REQS[2], "partial", "A Power App for collection.", ["nokia:quarter-end-close"])),
      withRow(2, row(REQS[2], "partial", "Quarter-end collection only.", ["nokia:quarter-end-close"])),
    ]);
    assert.equal(rowFor(out, REQS[2]).verdict, "partial");
    assert.deepEqual(rowFor(out, REQS[2]).agreement, { met: 1, partial: 2 });
  });

  test("a three-way split is unclear, with no one assessment's sentence or source under it", () => {
    const out = merge([
      withRow(0, row(REQS[0], "met", "SQL and DAX at Nokia.", ["resume:nokia"])),
      withRow(0, row(REQS[0], "partial", "Some SQL at Nokia.", ["resume:nokia"])),
      withRow(0, row(REQS[0], "unclear", "The record doesn't say how strong.")),
    ]);
    const sql = rowFor(out, REQS[0]);
    assert.equal(sql.verdict, "unclear");
    assert.equal(sql.evidence, "");
    assert.deepEqual(sql.sources, []);
    assert.equal(sql.downgrade, null, "a split is the consensus, not a downgrade");
    assert.deepEqual(sql.agreement, { met: 1, partial: 1, unclear: 1 });
    const note = agreementNote(agreementOf(sql));
    assert.equal(note, "split · 1 met, 1 partial, 1 unclear");
  });

  test("met against unmet is unclear even when met has the majority", () => {
    const out = merge([
      withRow(3, row(REQS[3], "met", "Configured CPQ at Nokia.", ["resume:nokia"])),
      withRow(3, row(REQS[3], "met", "CPQ at Nokia.", ["resume:nokia"])),
      withRow(3, row(REQS[3], "unmet", "No CPQ in the record.")),
    ]);
    const cpq = rowFor(out, REQS[3]);
    assert.equal(cpq.verdict, "unclear", "two runs saying met and one saying unmet is not a fit");
    assert.equal(cpq.evidence, "");
    assert.deepEqual(cpq.agreement, { met: 2, unmet: 1 });
    assert.equal(agreementNote(agreementOf(cpq)), "split · 2 met, 1 unmet");
  });

  test("partial against unmet is not a contradiction: the majority holds", () => {
    const out = merge([
      withRow(3, row(REQS[3], "partial", "Adjacent Salesforce work.", ["resume:nokia"])),
      withRow(3, row(REQS[3], "unmet", "No CPQ.")),
      withRow(3, row(REQS[3], "unmet", "No CPQ administration.")),
    ]);
    const cpq = rowFor(out, REQS[3]);
    assert.equal(cpq.verdict, "unmet");
    assert.equal(cpq.evidence, "No CPQ.", "the earliest assessment in the majority speaks for it");
    assert.deepEqual(cpq.sources, [], "the minority's citation doesn't come along");
  });

  test("the verdicts don't depend on which extra assessment came first", () => {
    const a = withRow(0, row(REQS[0], "met", "SQL and DAX at Nokia.", ["resume:nokia"]));
    const b = withRow(0, row(REQS[0], "partial", "Some SQL.", ["resume:nokia"]));
    const c = withRow(3, row(REQS[3], "partial", "Adjacent.", ["resume:nokia"]));
    const shape = (out) => out.rows.map((r) => [r.requirement, r.verdict, r.agreement ?? null]);
    assert.deepEqual(shape(merge([a, b, c])), shape(merge([a, c, b])));
    assert.deepEqual(shape(merge([a, b, c])), shape(merge([c, b, a])));
  });
});

// --- Citations --------------------------------------------------------------

describe("which citations survive", () => {
  test("only a source most of the majority cited", () => {
    const out = merge([
      withRow(1, row(REQS[1], "met", "Power BI for 150+ users.", ["resume:nokia", "nokia:quarter-end-close"])),
      withRow(1, row(REQS[1], "met", "Power BI reporting.", ["resume:nokia"])),
      withRow(1, row(REQS[1], "met", "Power BI at Nokia.", ["resume:nokia", "resume:a-darle-20"])),
    ]);
    assert.deepEqual(rowFor(out, REQS[1]).sources, ["resume:nokia"]);
  });

  test("on a 2–1 row, both of the majority must cite it, and the minority's sources never count", () => {
    const out = merge([
      withRow(2, row(REQS[2], "partial", "A Power App for quarter-end.", ["nokia:quarter-end-close", "resume:nokia"])),
      withRow(2, row(REQS[2], "met", "Quarter-end at Nokia.", ["resume:nokia"])),
      withRow(2, row(REQS[2], "partial", "Quarter-end collection.", ["nokia:quarter-end-close"])),
    ]);
    const close = rowFor(out, REQS[2]);
    assert.equal(close.verdict, "partial");
    assert.deepEqual(close.sources, ["nokia:quarter-end-close"]);
  });

  test("a positive majority with no source in common is downgraded, and says why", () => {
    const out = merge([
      withRow(1, row(REQS[1], "met", "Power BI.", ["resume:nokia"])),
      withRow(1, row(REQS[1], "met", "Dashboards.", ["nokia:quarter-end-close"])),
      withRow(1, row(REQS[1], "met", "Dashboards.", ["resume:a-darle-20"])),
    ]);
    const bi = rowFor(out, REQS[1]);
    assert.equal(bi.verdict, "unclear");
    assert.equal(bi.claimedVerdict, "met");
    assert.equal(bi.downgrade, "unshared", "it did cite: 'cited no source' would be false");
    assert.equal(agreementOf(bi), null, "they agreed on the verdict; there is no split to show");
    assert.equal(out.downgraded, 1);
  });

  test("the evidence is the sentence the kept sources hold up best", () => {
    const out = merge([
      withRow(1, row(REQS[1], "met", "Tableau dashboards for 900 users.", ["resume:nokia"])),
      withRow(1, row(REQS[1], "met", "Migrated sales reporting to Power BI for 150+ users.", ["resume:nokia"])),
      withRow(1, row(REQS[1], "met", "Built Looker dashboards.", ["resume:nokia"])),
    ]);
    const bi = rowFor(out, REQS[1]);
    assert.equal(bi.evidence, "Migrated sales reporting to Power BI for 150+ users.");
    assert.deepEqual(bi.unverified, []);
  });

  test("and it is still checked: a sentence the shared source doesn't hold is marked", () => {
    const out = merge([
      withRow(1, row(REQS[1], "met", "Tableau dashboards for 900 users.", ["resume:nokia"])),
      withRow(1, row(REQS[1], "met", "Tableau for 900 users.", ["resume:nokia"])),
      withRow(1, row(REQS[1], "partial", "Power BI.", ["resume:nokia"])),
    ]);
    const bi = rowFor(out, REQS[1]);
    assert.equal(bi.verdict, "met", "a near-miss keeps its verdict, as on a single assessment");
    assert.ok(bi.unverified.length > 0, "the merged evidence skipped lib/verify.ts");
  });

  test("an invented id most of them cited is kept and flagged, not laundered away", () => {
    const out = merge([
      withRow(1, row(REQS[1], "met", "Power BI for 150+ users.", ["resume:nokia", "resume:invented"])),
      withRow(1, row(REQS[1], "met", "Power BI reporting.", ["resume:nokia", "resume:invented"])),
      withRow(1, row(REQS[1], "met", "Power BI.", ["resume:nokia"])),
    ]);
    const bi = rowFor(out, REQS[1]);
    assert.deepEqual(bi.sources, ["resume:nokia"]);
    assert.deepEqual(bi.unknownSources, ["resume:invented"]);
  });
});

// --- The reconciler ---------------------------------------------------------

describe("interplay with the reconciler", () => {
  test("a claim with no valid source votes unclear: each vote is what that run would show", () => {
    const out = merge([
      withRow(0, row(REQS[0], "met", "SQL daily.", [])),
      withRow(0, row(REQS[0], "met", "SQL daily.", ["resume:invented"])),
      withRow(0, row(REQS[0], "met", "SQL and DAX.", ["resume:nokia"])),
    ]);
    const sql = rowFor(out, REQS[0]);
    assert.equal(sql.verdict, "unclear", "an uncited claim was counted as a vote for met");
    assert.deepEqual(sql.agreement, { met: 1, unclear: 2 });
    assert.equal(agreementNote(agreementOf(sql)), "2 of 3 agree");
  });

  test("a requirement one run skipped votes unclear", () => {
    const skipped = assessment([
      row(REQS[0], "met", "SQL and DAX.", ["resume:nokia"]),
      row(REQS[1], "met", "Power BI for 150+ users.", ["resume:nokia"]),
      row(REQS[2], "partial", "Quarter-end Power App.", ["nokia:quarter-end-close"]),
    ]);
    const full = withRow(3, row(REQS[3], "unmet", "No CPQ."));
    const out = merge([full, skipped, full]);
    const cpq = rowFor(out, REQS[3]);
    assert.equal(cpq.verdict, "unmet");
    assert.deepEqual(cpq.agreement, { unmet: 2, unclear: 1 });
    assert.equal(out.uncovered, 0, "every requirement has a row in the merged table");
  });

  test("a bare-string row (listed, not judged) votes unclear", () => {
    const unjudged = assessment([REQS[0], REQS[1], REQS[2], REQS[3]]);
    const judged = withRow(0, row(REQS[0], "met", "SQL and DAX.", ["resume:nokia"]));
    const out = merge([unjudged, unjudged, judged]);
    assert.ok(out.rows.every((r) => r.verdict === "unclear"));
    assert.deepEqual(rowFor(out, REQS[0]).agreement, { met: 1, unclear: 2 });
  });

  test("rows line up by the posting's words, not their position", () => {
    const a = withRow(3, row(REQS[3], "unmet", "No CPQ."));
    const reversed = { ...a, rows: [...a.rows].reverse() };
    const out = merge([a, reversed, a]);
    assert.ok(out.rows.every((r) => !r.agreement), "a reordered run was read as disagreeing");
    assert.deepEqual(out.rows.map((r) => r.requirement), REQS, "the table is in the posting's order");
  });

  test("a paraphrased requirement still lines up", () => {
    const a = withRow(0, row(REQS[0], "met", "SQL and DAX.", ["resume:nokia"]));
    const paraphrased = withRow(0, row("SQL, strong", "met", "SQL and DAX modeling.", ["resume:nokia"]));
    const out = merge([a, paraphrased, a]);
    assert.equal(rowFor(out, REQS[0]).verdict, "met");
    assert.equal(rowFor(out, REQS[0]).agreement, undefined);
  });

  test("a row that answers nothing the posting asked never enters the table", () => {
    const a = withRow(3, row(REQS[3], "unmet", "No CPQ."));
    const extra = { ...a, rows: [...a.rows, row("Kubernetes at scale", "met", "Power BI.", ["resume:nokia"])] };
    const out = merge([extra, a, a]);
    assert.deepEqual(out.rows.map((r) => r.requirement), REQS);
  });

  test("an unmet row the chosen gaps don't name is added to them; nothing is removed", () => {
    const own = withRow(3, row(REQS[3], "partial", "Adjacent Salesforce work.", ["resume:nokia"]));
    own.gaps = ["Advanced SQL is not established"];
    const other = withRow(3, row(REQS[3], "unmet", "No CPQ."));
    other.gaps = ["Advanced SQL is not established"];
    const out = merge([own, other, other]);
    assert.equal(rowFor(out, REQS[3]).verdict, "unmet");
    assert.deepEqual(out.gaps, ["Advanced SQL is not established", REQS[3]]);
  });

  test("with no gaps written, the reconciler derives them from the unmet rows", () => {
    const a = withRow(3, row(REQS[3], "unmet", "No CPQ."));
    a.gaps = [];
    const out = merge([a, a, a]);
    assert.deepEqual(out.gaps, [REQS[3]]);
  });

  test("the verdict line comes from the run closest to the consensus, the turn's own on a tie", () => {
    const own = withRow(0, row(REQS[0], "unmet", "No SQL."));
    own.verdict = "own line";
    const second = withRow(0, row(REQS[0], "met", "SQL and DAX.", ["resume:nokia"]));
    second.verdict = "second line";
    const third = withRow(0, row(REQS[0], "met", "SQL and DAX.", ["resume:nokia"]));
    third.verdict = "third line";
    // met, met, unmet is unclear: nobody matches row 0, so all tie on the rest.
    assert.equal(merge([own, second, third]).verdict, "own line");

    const partialOwn = withRow(0, row(REQS[0], "unclear", "Not covered."));
    partialOwn.verdict = "own line";
    // met, met, unclear is met: the second run agrees on every row, the turn's own on three.
    assert.equal(merge([partialOwn, second, third]).verdict, "second line");
  });

  test("the invariants the panel relies on still hold", () => {
    const samples = [
      withRow(0, row(REQS[0], "met", "SQL and DAX.", ["resume:nokia"])),
      withRow(1, row(REQS[1], "unmet", "No dashboards.")),
      withRow(3, row(REQS[3], "met", "CPQ.", ["resume:nokia"])),
    ];
    const out = merge(samples);
    const counted = Object.values(out.counts).reduce((a, b) => a + b, 0);
    assert.equal(counted, out.rows.length);
    for (const v of ["met", "partial", "unmet", "unclear"]) {
      assert.equal(out.counts[v], out.rows.filter((r) => r.verdict === v).length);
    }
    if (out.counts.unmet) assert.ok(out.gaps.length > 0);
    for (const r of out.rows) {
      if (r.verdict === "met" || r.verdict === "partial") assert.ok(r.sources.length > 0);
    }
  });
});

// --- Reading it back ----------------------------------------------------------

describe("the agreement line", () => {
  test("nothing to say for a unanimous, single or malformed record", () => {
    const base = { verdict: "met", claimedVerdict: null };
    assert.equal(agreementOf(base), null);
    assert.equal(agreementOf({ ...base, agreement: { met: 3 } }), null);
    assert.equal(agreementOf({ ...base, agreement: { met: 1 } }), null);
    assert.equal(agreementOf({ ...base, agreement: "2 of 3" }), null);
    assert.equal(agreementOf({ ...base, agreement: { met: 1.5, partial: 1 } }), null);
    assert.equal(agreementOf({ ...base, agreement: { met: -2, partial: 1 } }), null);
    assert.equal(agreementOf({ ...base, agreement: { met: 600, partial: 400 } }), null);
    assert.deepEqual(agreementOf({ ...base, agreement: { met: 2, partial: 1, bogus: 9 } }), {
      kind: "majority",
      count: 2,
      of: 3,
    });
  });

  test("a row downgraded after the vote shows the vote for what it was settled on", () => {
    const r = { verdict: "unclear", claimedVerdict: "met", agreement: { met: 2, partial: 1 } };
    assert.deepEqual(agreementOf(r), { kind: "majority", count: 2, of: 3 });
  });

  test("counts, never a share or a decimal (docs/idea-decisions.md §3)", () => {
    const notes = [
      agreementNote({ kind: "majority", count: 2, of: 3 }),
      agreementNote({ kind: "majority", count: 4, of: 5 }),
      agreementNote({ kind: "split", votes: [["met", 1], ["partial", 1], ["unmet", 1]], of: 3 }),
      FIT_CONSENSUS.note(3),
      FIT_CONSENSUS.unshared("met"),
    ];
    for (const note of notes) {
      assert.ok(!/%|\d\.\d|percent/i.test(note), `"${note}" reads as a measurement`);
      assert.equal(note, note.replace(/[A-Z]{2,}/g, ""), `"${note}" has all-caps text`);
    }
    assert.equal(notes[0], "2 of 3 agree");
  });

  test("the panel and the print sheet both render it, and only from the row", () => {
    const panel = read("components/shell/panel-body.tsx");
    const print = read("components/shell/print-sheet.tsx");
    // The count under the tag; a split or a downgraded row's vote in the line.
    assert.match(panel, /<VerdictTag row=\{row\} \/>/);
    assert.match(panel, /<AgreementMark row=\{row\} \/>/);
    assert.match(print, /<PrintedCount row=\{row\} \/>/);
    assert.match(print, /<PrintedAgreement row=\{row\} \/>/);
    for (const src of [panel, print]) {
      assert.match(src, /agreementOf\(row\)/);
      assert.match(src, /kind === "majority" && row\.downgrade === null/);
      assert.match(src, /samples > 1 &&/, "the consensus note shows on a single assessment");
    }
    assert.equal(agreementCount({ count: 2, of: 3 }), "2 of 3");
  });
});

// --- What the model reads -----------------------------------------------------

describe("the summary's input", () => {
  test("the model reads the merged table without the vote bookkeeping", () => {
    const out = merge([
      withRow(0, row(REQS[0], "met", "SQL and DAX.", ["resume:nokia"])),
      withRow(0, row(REQS[0], "partial", "Some SQL.", ["resume:nokia"])),
      withRow(0, row(REQS[0], "met", "SQL.", ["resume:nokia"])),
    ]);
    const seen = forModel(out);
    assert.ok(!("samples" in seen));
    assert.ok(seen.rows.every((r) => !("agreement" in r)));
    assert.deepEqual(
      seen.rows.map((r) => r.verdict),
      out.rows.map((r) => r.verdict),
      "the model must read the verdicts the reader sees",
    );
  });

  test("with one assessment it is the SDK's default output exactly", () => {
    const out = merge([withRow(0, row(REQS[0], "met", "SQL.", ["resume:nokia"]))]);
    assert.deepEqual(forModel(out), JSON.parse(JSON.stringify(out)));
    assert.equal(JSON.stringify(forModel(out)), JSON.stringify(out));
  });

  test("the system prompt tells the summary to follow the returned table", () => {
    const prompt = read("lib/system-prompt.ts");
    assert.match(prompt, /Write the sentences after the\s+call from the returned table\./);
  });
});

// --- Links --------------------------------------------------------------------

describe("links carry the consensus, and old links still open", () => {
  // The recorded 14-row fit check (docs/application-links.md), with the vote
  // written onto `disagreeing` of its rows the way the merge writes it.
  const RECORDED = JSON.parse(read("evals/fixtures/recorded-fit-check.json")).messages;
  const withConsensus = (disagreeing) =>
    RECORDED.map((m) => ({
      ...m,
      parts: m.parts.map((p) => {
        if (p.type !== "tool-roleFit") return p;
        const rows = p.output.rows.map((r, i) =>
          i < disagreeing ? { ...r, agreement: i % 2 ? { met: 2, partial: 1 } : { partial: 2, unmet: 1 } } : r,
        );
        return { ...p, output: { ...p.output, rows, samples: 3 } };
      }),
    }));
  const REF = "https://sidhantmathur.com/?ref=a-forty-character-company-slug-123456";

  test("the vote adds tens of characters, not hundreds, and the short link still fits", async () => {
    const { permalinkFor, fitPermalinkFor, PERMALINK_SAFE_CHARS } = await import("../lib/permalink.ts");
    const fullBefore = (await permalinkFor(REF, RECORDED)).length;
    const shortBefore = (await fitPermalinkFor(REF, RECORDED)).length;
    // Every row disagreeing is the worst case; measured at +50 and +34.
    const full = (await permalinkFor(REF, withConsensus(14))).length;
    const short = (await fitPermalinkFor(REF, withConsensus(14))).length;
    assert.ok(full - fullBefore < 100, `the full link grew by ${full - fullBefore} characters`);
    assert.ok(short - shortBefore < 60, `the short link grew by ${short - shortBefore} characters`);
    assert.ok(short < PERMALINK_SAFE_CHARS, `the short fit link is ${short} characters`);
  });

  test("the vote survives the trip through both links", async () => {
    const { permalinkFor, fitPermalinkFor, decodeSnapshot, payloadFromHash } = await import("../lib/permalink.ts");
    const { latestRoleFit } = await import("../lib/transcript.ts");
    const sent = withConsensus(5);
    const original = latestRoleFit(sent);
    for (const link of [await permalinkFor(REF, sent), await fitPermalinkFor(REF, sent)]) {
      const back = latestRoleFit(await decodeSnapshot(payloadFromHash(link.slice(link.indexOf("#")))));
      assert.equal(back.samples, 3);
      for (const r of back.rows) {
        const was = original.rows.find((o) => o.requirement === r.requirement);
        assert.deepEqual(r.agreement, was.agreement);
      }
    }
  });

  test("a link made before the consensus decodes to a table with nothing new to show", async () => {
    const { permalinkFor, decodeSnapshot, payloadFromHash } = await import("../lib/permalink.ts");
    const { latestRoleFit } = await import("../lib/transcript.ts");
    const link = await permalinkFor(REF, RECORDED);
    const fit = latestRoleFit(await decodeSnapshot(payloadFromHash(link.slice(link.indexOf("#")))));
    assert.ok(Array.isArray(fit.rows) && fit.counts && Array.isArray(fit.gaps), "the panel can't render it");
    assert.equal(fit.samples, undefined);
    assert.ok(fit.rows.every((r) => agreementOf(r) === null));
  });
});

// --- Cost ---------------------------------------------------------------------

describe("what the extra assessments cost", () => {
  const reported = {
    inputTokens: 9000,
    cachedInputTokens: 6000,
    cacheWriteTokens: 0,
    outputTokens: 1500,
    reasoningTokens: 100,
    totalTokens: 10500,
  };

  test("usage adds field by field, and null only when both are", () => {
    assert.deepEqual(addUsage(reported, reported), {
      inputTokens: 18000,
      cachedInputTokens: 12000,
      cacheWriteTokens: 0,
      outputTokens: 3000,
      reasoningTokens: 200,
      totalTokens: 21000,
    });
    assert.equal(addUsage(null, null), null);
    assert.deepEqual(addUsage(null, reported), reported);
    assert.equal(addUsage({ ...reported, reasoningTokens: null }, { ...reported, reasoningTokens: null }).reasoningTokens, null);
  });

  test("a run that never reported is counted at a ceiling no real run of it can exceed", () => {
    for (const model of Object.keys(MODEL_PRICES)) {
      const price = MODEL_PRICES[model];
      const ceiling = usageCeiling(9000, 4000, price);
      const bound = costOfTurn(model, ceiling).total;
      // Whatever mix of cache reads, writes and fresh input the provider billed
      // for the same prompt, and however much it wrote up to the ceiling.
      for (const [cached, writes] of [[0, 0], [9000, 0], [0, 9000], [3000, 6000], [6000, 0]]) {
        for (const out of [0, 1500, 4000]) {
          const actual = costOfTurn(model, {
            inputTokens: 9000,
            cachedInputTokens: cached,
            cacheWriteTokens: writes,
            outputTokens: out,
          }).total;
          assert.ok(bound >= actual - 1e-12, `${model}: ceiling $${bound} under a possible $${actual}`);
        }
      }
    }
  });

  test("the extra usage sums what reported and the ceiling for what didn't", () => {
    const ceiling = usageCeiling(9000, 4000, MODEL_PRICES[DEFAULT_MODEL]);
    const { usage, estimated } = extraUsage([reported, null], ceiling);
    assert.equal(estimated, 1);
    assert.equal(usage.outputTokens, 1500 + 4000);
    assert.equal(usage.inputTokens, 18000);
    assert.deepEqual(extraUsage([], ceiling), { usage: null, estimated: 0 });
  });

  test("the default model's extra assessments never price below what they reported", () => {
    const ceiling = usageCeiling(9000, 4000, MODEL_PRICES[DEFAULT_MODEL]);
    const two = extraUsage([reported, reported], ceiling).usage;
    const one = costOfTurn(DEFAULT_MODEL, reported).total;
    assert.ok(Math.abs(costOfTurn(DEFAULT_MODEL, two).total - 2 * one) < 1e-12);
  });
});
