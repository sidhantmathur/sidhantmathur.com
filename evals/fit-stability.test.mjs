// The fit check at scale, checked without a model: the posting corpus, the
// request the harness sends, the stream it reads, the row matching and
// agreement arithmetic, and the spend cap (docs/fit-check-at-scale.md).
//
// The live half of the harness spends money against the production key, so
// everything that decides what it measures or when it stops is a pure function
// held here to hand-built cases. The mock server (evals/lib/mock-chat-server.mjs)
// stands in for the route, in-process, so these tests open no port.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { JD_PREFIX, MAX_POSTING_TEXT, MAX_USER_TEXT, looksLikeJobPosting } from "../lib/job-posting.ts";
import { DEFAULT_MODEL, MODEL_IDS, maxOutputTokensFor, reasoningFor } from "../lib/models.ts";
import { MODEL_PRICES } from "../lib/pricing.ts";
import { CONSISTENCY_SAMPLES } from "../lib/consistency.ts";
import { ROOT, read } from "./lib/artifacts.mjs";
import {
  classifyPosting,
  compensationFromText,
  dedupePostings,
  htmlToText,
  lengthFacts,
  pastedAsSent,
  qualificationsOffset,
} from "./lib/postings.mjs";
import {
  MEASURED_POSTING_CHARS,
  MEASURED_POSTING_TURNS,
  routeMaxOutputTokensJd,
  ROUTE_MAX_STEPS,
  SpendGuard,
  aggregateSetting,
  assertSendable,
  bodyText,
  ceilingTurnUsd,
  cellKey,
  chargeFor,
  clusterRepeats,
  createStreamReader,
  effectiveReasoning,
  finishedKeys,
  fleissKappa,
  jdRequestBody,
  lengthScale,
  matchRows,
  planCells,
  postingAgreement,
  projectTurnUsd,
  readCorpus,
  readResults,
  requirementSimilarity,
  runTurn,
  selectPostings,
  spentSoFar,
  summarizeTurn,
} from "./lib/fit-stability.mjs";
import { createMockChat } from "./lib/mock-chat-server.mjs";

const CHUNKS = {
  "resume:nokia": {
    id: "resume:nokia",
    text: "Resume — Nokia\nMigrated all sales reporting from Salesforce Analytics to Power BI for 150+ users, owning data modeling in SQL and DAX. Quarter-end reporting tool used across seven regions.",
  },
};

// --- The corpus helpers ---------------------------------------------------------

describe("htmlToText — a posting as a visitor would paste it", () => {
  test("decodes Greenhouse's entity-escaped HTML before parsing it", () => {
    const escaped = "&lt;h2&gt;About the role&lt;/h2&gt;&lt;p&gt;Own the forecast &amp;amp; the close.&lt;/p&gt;";
    assert.equal(htmlToText(escaped), "About the role\n\nOwn the forecast & the close.");
  });

  test("list items become '- ' lines, with no blank line between them", () => {
    const html = "<p>What you'll do</p><ul><li><p>Build dashboards</p></li><li><p>Run&nbsp;the forecast</p></li></ul>";
    assert.equal(htmlToText(html), "What you'll do\n\n- Build dashboards\n- Run the forecast");
  });

  test("drops scripts and styles, keeps line breaks, folds typed bullets", () => {
    const html = "<style>p{}</style><div>• One<br>• Two</div><script>x()</script>";
    assert.equal(htmlToText(html), "- One\n- Two");
  });
});

describe("classifyPosting — families and controls by title", () => {
  const cases = [
    ["Revenue Operations Manager", { family: "revops", control: "none" }],
    ["Senior Sales Operations Analyst", { family: "sales-ops", control: "none" }],
    ["GTM Systems Engineer", { family: "gtm-systems", control: "none" }],
    ["Business Systems Analyst, GTM Systems", { family: "gtm-systems", control: "none" }],
    ["Revenue Analytics Manager", { family: "sales-revenue-analytics", control: "none" }],
    ["Strategy & Operations, Support", { family: "delivery-program-ops", control: "none" }],
    ["Salesforce Administrator", { control: "near-miss", kind: "salesforce-admin" }],
    ["Deal Desk Analyst", { control: "near-miss", kind: "cpq-deal-desk" }],
    ["Staff Research Engineer, Multi-Agent Scaling", { control: "mismatch", kind: "ml-infra" }],
    ["Machine Learning Engineer, Ranking", { control: "mismatch", kind: "ml-infra" }],
    ["Staff Software Engineer, Backend", { control: "mismatch", kind: "staff-swe" }],
    ["Enterprise Account Executive", { control: "mismatch", kind: "enterprise-ae" }],
    ["Engineering Manager, Data Platform", { control: "mismatch", kind: "people-manager" }],
  ];
  for (const [title, expected] of cases) {
    test(title, () => {
      const got = classifyPosting(title);
      for (const [k, v] of Object.entries(expected)) assert.equal(got?.[k], v, `${title}: ${k}`);
    });
  }

  test("out-of-scope titles are dropped, whatever else they say", () => {
    for (const title of ["GTM Recruiter", "People Partner, GTM", "Senior Technical Program Manager - Security", "Legal Operations Analyst", "Strategic Finance, GTM", "Staff Software Engineer, Sales Data & Agents"]) {
      assert.equal(classifyPosting(title), null, title);
    }
  });

  test("a delivery posting centred on PSA work is a near miss", () => {
    const text = "Own our PSA (Certinia) configuration, billable utilization reporting and SOW intake.";
    assert.deepEqual(classifyPosting("Professional Services Operations Manager", text), {
      family: "delivery-program-ops",
      control: "near-miss",
      kind: "psa-delivery",
    });
    assert.equal(classifyPosting("Professional Services Operations Manager", "Run the operating cadence.").control, "none");
  });
});

describe("dedupePostings", () => {
  // Real postings run to thousands of words; a city is a rounding error in them.
  const body = Array.from({ length: 80 }, (_, i) => `requirement${i} detail${i}`).join(" ");
  const p = (id, company, title, text) => ({ id, company, title, text });

  test("one role posted per city is kept once; a different role at the same company is kept", () => {
    const { kept, dropped } = dedupePostings([
      p("a", "Acme", "RevOps Manager, Germany", `${body} Location: Berlin.`),
      p("b", "Acme", "RevOps Manager, France", `${body} Location: Paris.`),
      p("c", "Acme", "Sales Compensation Analyst", "Design and run sales compensation plans, quota letters and commission statements. ".repeat(20)),
      p("a", "Acme", "RevOps Manager, Germany", body),
    ]);
    assert.deepEqual(kept.map((x) => x.id), ["a", "c"]);
    assert.equal(dropped, 2);
  });
});

describe("the length the site accepts", () => {
  test("the paste panel's cap is the route's cap less the prefix and a blank line", () => {
    assert.equal(MAX_POSTING_TEXT, MAX_USER_TEXT - `${JD_PREFIX}\n\n`.length);
  });

  test("a long paste is cut at the cap, then trimmed, as JobDescriptionForm does", () => {
    const text = `${"a".repeat(MAX_POSTING_TEXT - 1)} ${"b".repeat(500)}`;
    assert.equal(pastedAsSent(text), "a".repeat(MAX_POSTING_TEXT - 1));
    const facts = lengthFacts(text);
    assert.equal(facts.cutBySite, true);
    assert.equal(facts.charsLost, text.length - MAX_POSTING_TEXT);
  });

  test("the panel's slicing still matches the form's source", () => {
    const form = read("components/shell/panel-body.tsx");
    assert.match(form, /const JD_MAX = MAX_POSTING_TEXT;/);
    assert.match(form, /setValue\(e\.target\.value\.slice\(0, JD_MAX\)\)/);
    assert.match(form, /onSubmit\(trimmed\.slice\(0, JD_MAX\)\)/);
    assert.match(read("components/shell/app-shell.tsx"), /ask\(`\$\{JD_COPY\.prefix\}\\n\\n\$\{text\}`\)/);
  });

  test("a qualifications section past the cap is lost entirely", () => {
    const text = `About us\n${"x".repeat(MAX_POSTING_TEXT)}\n\nWhat you'll bring\n- SQL`;
    assert.equal(qualificationsOffset(text) > MAX_POSTING_TEXT, true);
    assert.equal(lengthFacts(text).qualificationsLost, true);
  });

  test("a salary is read from a line about pay, not from the company blurb", () => {
    const text = "We process $275B in annualized spend.\n\nThe annual base salary range for this role is $185,000-$275,000.";
    assert.equal(compensationFromText(text).text, "$185,000-$275,000");
  });
});

// --- What the harness sends -------------------------------------------------------

describe("jdRequestBody — the request the paste panel makes", () => {
  const posting = `Revenue Operations Analyst\n\nWhat you'll do\n- Own the forecast\n${"- Build reporting in SQL\n".repeat(400)}`;
  const body = jdRequestBody({ posting, model: DEFAULT_MODEL, chatId: "c1", messageId: "m1" });

  test("one user message, the prefix, a blank line, then the posting as pasted", () => {
    assert.equal(body.messages.length, 1);
    assert.equal(body.messages[0].role, "user");
    assert.equal(body.model, DEFAULT_MODEL);
    assert.equal(bodyText(body), `${JD_PREFIX}\n\n${pastedAsSent(posting)}`);
  });

  test("a posting at the cap is still under the route's limit and still read as a posting", () => {
    assert.ok(bodyText(body).length <= MAX_USER_TEXT);
    assert.ok(looksLikeJobPosting(bodyText(body)));
    assert.doesNotThrow(() => assertSendable(body));
  });

  test("the catalogue's reasoning level is what a posting turn is labelled with", () => {
    assert.equal(effectiveReasoning("openai/gpt-6-luna", "catalogue"), "low");
    // Every row, read from the catalogue, so a row gaining or losing a level
    // can't leave this test asserting the old one.
    for (const id of MODEL_IDS) {
      assert.equal(
        effectiveReasoning(id, "catalogue"),
        reasoningFor(id, { jobPosting: true }) ?? "provider-default",
        id,
      );
    }
    assert.equal(effectiveReasoning("openai/gpt-6-luna", "none"), "none");
  });
});

describe("planCells and selectPostings", () => {
  const postings = Array.from({ length: 30 }, (_, i) => ({
    id: `p${i}`,
    text: "x",
    family: ["revops", "sales-ops"][i % 2],
    control: i % 10 === 0 ? "mismatch" : "none",
  }));

  test("repeat-major, so a run stopped early holds whole repeats", () => {
    const cells = planCells({ postings: postings.slice(0, 2), models: [DEFAULT_MODEL], reasonings: ["catalogue"], repeats: 2 });
    assert.deepEqual(cells.map((c) => `${c.postingId}:${c.repeat}`), ["p0:1", "p1:1", "p0:2", "p1:2"]);
    assert.equal(new Set(cells.map((c) => c.key)).size, cells.length);
    assert.equal(cells[0].key, cellKey({ postingId: "p0", model: DEFAULT_MODEL, reasoning: "low", repeat: 1 }));
  });

  test("perStratum takes up to n from each stratum, the same ones every time", () => {
    const a = selectPostings(postings, { perStratum: 2 });
    const b = selectPostings(postings, { perStratum: 2 });
    assert.deepEqual(a.map((p) => p.id), b.map((p) => p.id));
    assert.equal(a.length, 6);
    assert.equal(a.filter((p) => p.control === "mismatch").length, 2);
  });
});

// --- Reading the stream -------------------------------------------------------------

describe("createStreamReader", () => {
  test("joins a line split across reads and times each event", () => {
    const r = createStreamReader();
    const lines = [
      { type: "start" },
      { type: "tool-input-start", toolCallId: "a", toolName: "extractRequirements" },
      { type: "tool-output-available", toolCallId: "a", output: { requirements: ["SQL"] } },
      { type: "text-delta", id: "t", delta: "Hello" },
      { type: "data-turn", id: "turn", data: { finishReason: "stop" } },
    ].map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";
    const cut = lines.indexOf("tool-output-available") + 5;
    r.feed(lines.slice(0, cut), 100);
    r.feed(lines.slice(cut), 350);
    const out = r.end(400);
    assert.equal(out.tools.length, 1);
    assert.equal(out.tools[0].inputStartAt, 100);
    assert.equal(out.tools[0].outputAt, 350);
    assert.equal(out.text, "Hello");
    assert.equal(out.telemetry.finishReason, "stop");
    assert.equal(out.maxGapMs, 250);
    assert.equal(out.done, true);
  });

  test("an error chunk on an HTTP 200 is a stream error", () => {
    const r = createStreamReader();
    r.feed(`data: ${JSON.stringify({ type: "error", errorText: "upstream_timeout" })}\n\n`, 5);
    assert.equal(r.end(6).streamError, "upstream_timeout");
  });
});

describe("runTurn and summarizeTurn, against the mock route", () => {
  const posting = `GTM Systems Manager\n\nWhat you'll do\n- Own Salesforce reporting\n- 4+ years in revenue operations\nThis role is remote.`;
  const body = jdRequestBody({ posting, model: DEFAULT_MODEL, chatId: "c", messageId: "m" });

  test("a replayed turn: both tools, a card, telemetry, a cost, citations checked", async () => {
    const mock = createMockChat({ mode: "replay", vary: 0 });
    const turn = await runTurn({ base: "http://mock", body, fetchImpl: mock.fetch });
    assert.equal(turn.status, "ok");
    assert.equal(turn.mock, "replay");
    const s = summarizeTurn(turn, { model: DEFAULT_MODEL, lookup: CHUNKS });
    assert.equal(s.calledExtract, true);
    assert.equal(s.calledRoleFit, true);
    assert.equal(s.roleFitCalls, 1);
    assert.equal(s.requirementCount, 14);
    assert.equal(s.rows.length, 14);
    assert.equal(s.blank, false);
    assert.equal(s.telemetry.finishReason, "stop");
    assert.ok(s.costUsd > 0);
    assert.ok(s.timings.cardMs >= s.timings.extractedMs);
    assert.ok(s.citations.positiveRows > 0);
    assert.ok(s.citations.positiveVerified <= s.citations.positiveRows);
  });

  test("the route's no-key answer is an HTTP 502 with its class, and nothing streamed", async () => {
    const mock = createMockChat({ mode: "no-key" });
    const turn = await runTurn({ base: "http://mock", body, fetchImpl: mock.fetch });
    assert.equal(turn.status, "http-error");
    assert.equal(turn.httpStatus, 502);
    assert.equal(turn.errorClass, "upstream_unconfigured");
    assert.equal(mock.stats.streamed, 0);
  });

  test("the hourly budget: the 21st turn from one bucket is a 429, a new bucket is not", async () => {
    const mock = createMockChat({ mode: "replay" });
    let last;
    for (let i = 0; i < 21; i += 1) last = await runTurn({ base: "http://mock", body, headers: { "x-forwarded-for": "one" }, fetchImpl: mock.fetch });
    assert.equal(last.httpStatus, 429);
    const fresh = await runTurn({ base: "http://mock", body, headers: { "x-forwarded-for": "two" }, fetchImpl: mock.fetch });
    assert.equal(fresh.status, "ok");
  });

  test("a blank turn and a mid-stream error are recorded as what they are", async () => {
    const blank = await runTurn({ base: "http://mock", body, fetchImpl: createMockChat({ mode: "blank" }).fetch });
    const s = summarizeTurn(blank, { model: DEFAULT_MODEL, lookup: CHUNKS });
    assert.equal(s.status, "ok");
    assert.equal(s.blank, true);
    assert.equal(s.telemetry.finishReason, "length");
    const broke = await runTurn({ base: "http://mock", body, fetchImpl: createMockChat({ mode: "stream-error" }).fetch });
    assert.equal(broke.status, "stream-error");
    assert.equal(broke.error, "upstream_timeout");
  });

  test("an over-long turn is the route's 400, which the harness never sends", async () => {
    const tooLong = { ...body, messages: [{ ...body.messages[0], parts: [{ type: "text", text: "x".repeat(MAX_USER_TEXT + 1) }] }] };
    const turn = await runTurn({ base: "http://mock", body: tooLong, fetchImpl: createMockChat().fetch });
    assert.equal(turn.httpStatus, 400);
    assert.throws(() => assertSendable(tooLong));
  });

  test("a server that isn't there is a transport error, not a crash", async () => {
    const turn = await runTurn({
      base: "http://nowhere",
      body,
      fetchImpl: async () => {
        throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
      },
    });
    assert.equal(turn.status, "transport-error");
    assert.equal(turn.reachedServer, false);
    assert.equal(turn.error, "ECONNREFUSED");
  });
});

// --- Matching rows across repeats ------------------------------------------------------

describe("requirementSimilarity and matchRows", () => {
  const full = "Advanced SQL. You can write the query yourself rather than asking a data team for an extract.";

  test("verbatim and re-punctuated copies match exactly", () => {
    assert.equal(requirementSimilarity("- Advanced SQL.", "advanced sql"), 1);
  });

  test("a trimmed copy of the same bullet matches; a different requirement doesn't", () => {
    assert.ok(requirementSimilarity(full, "You can write the query yourself rather than asking a data team") >= 0.5);
    assert.ok(requirementSimilarity("Hands-on Salesforce administration", "Experience with CPQ and quote-to-cash") < 0.5);
  });

  test("a one-word requirement doesn't match a long one by sharing its word", () => {
    assert.ok(requirementSimilarity("SQL", "Experience with SQL, dbt, Snowflake and Looker for executive reporting") < 0.5);
  });

  test("pairs are one to one, best first", () => {
    const left = [{ requirement: "Own the weekly forecast call" }, { requirement: "Build executive dashboards in Tableau" }];
    const right = [{ requirement: "Build executive dashboards in Tableau or Looker" }, { requirement: "Own the weekly forecast call package" }];
    assert.equal(matchRows(left, right).length, 2);
    const pairs = new Map(matchRows(left, right).map(([i, j]) => [i, j]));
    assert.equal(pairs.get(0), 1);
    assert.equal(pairs.get(1), 0);
  });
});

describe("clusterRepeats and postingAgreement", () => {
  const row = (requirement, verdict) => ({ requirement, verdict });
  const turn = (rows, extra = {}) => ({
    status: "ok",
    rows,
    requirementCount: rows.length,
    counts: { met: rows.filter((r) => r.verdict === "met").length, partial: rows.filter((r) => r.verdict === "partial").length, unmet: rows.filter((r) => r.verdict === "unmet").length, unclear: rows.filter((r) => r.verdict === "unclear").length },
    ...extra,
  });

  const r1 = turn([row("Advanced SQL", "partial"), row("4+ years in revenue operations", "unmet"), row("Hands-on Salesforce administration", "unmet")]);
  // Reordered, one verdict moved, one requirement rephrased.
  const r2 = turn([row("Hands-on Salesforce administration and certification", "unmet"), row("Advanced SQL", "met"), row("4+ years in revenue operations", "unmet")]);
  // One requirement dropped by the extraction.
  const r3 = turn([row("Advanced SQL", "partial"), row("4+ years in revenue operations", "unmet")]);

  test("rows of the same requirement land in one cluster, at most one per repeat", () => {
    const clusters = clusterRepeats([r1.rows, r2.rows, r3.rows]);
    assert.equal(clusters.length, 3);
    for (const c of clusters) assert.equal(c.members.length, 3);
    const sf = clusters.find((c) => c.members[0]?.requirement.startsWith("Hands-on"));
    assert.equal(sf.members[1].requirement, "Hands-on Salesforce administration and certification");
    assert.equal(sf.members[2], null);
  });

  test("the agreement numbers", () => {
    const a = postingAgreement([r1, r2, r3]);
    assert.equal(a.carded, 3);
    assert.deepEqual(a.extractionCounts, [3, 3, 2]);
    assert.equal(a.extractionAgrees, false);
    assert.equal(a.countsDiffer, true);
    assert.equal(a.compared, 3);
    assert.equal(a.unstable, 1);
    assert.equal(a.stable, 2);
    assert.equal(a.metUnmetFlips, 0);
    assert.equal(a.partialPresence, 1);
    // Pairs: (1,2) share 3 rows, 2 agree; (1,3) share 2, 2 agree; (2,3) share 2, 1 agrees.
    assert.equal(a.pairShared, 7);
    assert.equal(a.pairSame, 5);
    // Kappa only over rows every repeat has: SQL (partial, met, partial), years (unmet ×3).
    assert.equal(a.fullItems.length, 2);
  });

  test("identical repeats agree completely", () => {
    const a = postingAgreement([r1, r1, r1]);
    assert.equal(a.countsDiffer, false);
    assert.equal(a.unstable, 0);
    assert.equal(a.rowAgreement, 1);
    assert.equal(a.pairwiseAgreement, 1);
  });

  test("Fleiss' kappa on a hand-computed case", () => {
    const k = fleissKappa([["met", "met", "met"], ["unmet", "unmet", "unmet"], ["met", "met", "unmet"]]);
    assert.ok(Math.abs(k - 0.55) < 1e-9, String(k));
    assert.equal(fleissKappa([["met", "met"], ["met", "met"]]), null);
  });

  test("aggregateSetting: the negative-control check and the pooled rates", () => {
    const records = [
      { ...r1, key: "a|1", postingId: "a", control: "none", family: "revops", calledExtract: true, calledRoleFit: true },
      { ...r2, key: "a|2", postingId: "a", control: "none", family: "revops", calledExtract: true, calledRoleFit: true },
      { ...turn([row("GPU cluster operations", "unmet"), row("CUDA kernels", "unmet")]), key: "m|1", postingId: "m", control: "mismatch", calledExtract: true, calledRoleFit: true },
      { ...turn([row("GPU cluster operations", "unmet"), row("CUDA kernels", "partial")]), key: "m|2", postingId: "m", control: "mismatch", calledExtract: true, calledRoleFit: true },
      { status: "stream-error", key: "x|1", postingId: "x", control: "none" },
    ];
    const a = aggregateSetting(records);
    assert.equal(a.turns, 5);
    assert.equal(a.toolCalls.both.num, 4);
    assert.equal(a.mismatchMostlyUnmet.num, 2);
    assert.equal(a.verdicts.mismatch.unmet.num, 3);
    assert.equal(a.comparedPostings, 2);
    assert.equal(a.countsDiffer.num, 2);
  });
});

// --- Spend ----------------------------------------------------------------------------------

describe("SpendGuard — the hard cap", () => {
  test("refuses a reservation that would pass the cap", () => {
    const g = new SpendGuard({ maxUsd: 0.05 });
    const a = g.tryReserve(0.03);
    assert.ok(a);
    assert.equal(g.tryReserve(0.03), null, "two holds of 0.03 would be 0.06");
    g.settle(a, 0.002);
    assert.ok(g.tryReserve(0.03), "settling frees the difference");
  });

  test("an unknown cost stays charged at its reservation; a request that never arrived costs nothing", () => {
    const g = new SpendGuard({ maxUsd: 1 });
    const a = g.tryReserve(0.02);
    assert.equal(g.settle(a, null), 0.02);
    const b = g.tryReserve(0.02);
    g.release(b);
    assert.equal(g.committed, 0.02);
  });

  test("what earlier invocations spent counts against the cap", () => {
    const g = new SpendGuard({ maxUsd: 1, alreadySpentUsd: 0.99 });
    assert.equal(g.tryReserve(0.02), null);
    assert.ok(g.tryReserve(0.01));
  });

  test("the guard never lets committed spend pass the cap, however turns settle", () => {
    const g = new SpendGuard({ maxUsd: 0.1 });
    let sent = 0;
    for (let i = 0; i < 1000; i += 1) {
      const h = g.tryReserve(0.0241);
      if (h == null) break;
      sent += 1;
      g.settle(h, i % 7 === 0 ? null : 0.0028);
      assert.ok(g.committed <= 0.1 + 1e-12);
    }
    assert.ok(sent > 10);
  });
});

describe("the cost model", () => {
  test("the route's limits the ceiling assumes are the route's limits", () => {
    const route = read("app/api/chat/route.ts");
    // The per-step cap comes from the catalogue, by kind of turn, in both the
    // turn's own call and its extra assessments.
    assert.match(route, /maxOutputTokens: maxOutputTokensFor\(model, \{ jobPosting \}\)/);
    assert.match(route, /maxOutputTokens: maxOutputTokensFor\(model, \{ jobPosting: true \}\)/);
    assert.equal(routeMaxOutputTokensJd(DEFAULT_MODEL), maxOutputTokensFor(DEFAULT_MODEL, { jobPosting: true }));
    assert.match(route, new RegExp(`stopWhen: stepCountIs\\(${ROUTE_MAX_STEPS}\\)`));
  });

  test("the ceiling pays for the extra assessments", () => {
    // One extra assessment at its worst is the judging step's input plus a
    // full output cap, so the ceiling must exceed a turn without them by at
    // least that much output per extra sample.
    const model = DEFAULT_MODEL;
    const price = MODEL_PRICES[model];
    const withSamples = ceilingTurnUsd({ model, chars: 4000 });
    const minExtra = ((CONSISTENCY_SAMPLES - 1) * routeMaxOutputTokensJd(model) * price.output) / 1e6;
    const single = ROUTE_MAX_STEPS * routeMaxOutputTokensJd(model) * price.output / 1e6;
    assert.ok(CONSISTENCY_SAMPLES >= 1);
    assert.ok(withSamples > single + minExtra - 1e-12, `${withSamples} vs ${single} + ${minExtra}`);
  });

  test("every measured posting turn is under its model's ceiling", () => {
    for (const [key, m] of Object.entries(MEASURED_POSTING_TURNS)) {
      const model = key.split("|")[0];
      const ceiling = ceilingTurnUsd({ model, chars: MEASURED_POSTING_CHARS });
      for (const usd of m.usd) assert.ok(chargeFor(model, usd) < ceiling, `${key}: ${usd} vs ${ceiling}`);
    }
  });

  test("every catalogue model has a ceiling and a measured projection", () => {
    for (const model of MODEL_IDS) {
      assert.ok(ceilingTurnUsd({ model, chars: MAX_POSTING_TEXT }) > 0, model);
      assert.ok(projectTurnUsd({ model, reasoning: effectiveReasoning(model, "catalogue"), chars: MAX_POSTING_TEXT }), model);
    }
  });

  test("cost scales with the posting's length and is anchored at the measured one", () => {
    assert.ok(Math.abs(lengthScale(MEASURED_POSTING_CHARS) - 1) < 1e-12);
    assert.ok(lengthScale(MAX_POSTING_TEXT) > 1);
    assert.ok(lengthScale(500) < lengthScale(2000));
  });
});

// --- Results files ----------------------------------------------------------------------------

describe("resuming a run", () => {
  test("a torn last line is skipped; only finished turns are skipped on restart; spend carries over", () => {
    const dir = mkdtempSync(join(tmpdir(), "fit-"));
    const file = join(dir, "r.jsonl");
    writeFileSync(
      file,
      [
        JSON.stringify({ key: "a", status: "ok", chargedUsd: 0.003 }),
        JSON.stringify({ key: "b", status: "stream-error", chargedUsd: 0.024 }),
        '{"key":"c","sta',
      ].join("\n"),
    );
    const records = readResults(file);
    assert.equal(records.length, 2);
    assert.deepEqual([...finishedKeys(records)], ["a"]);
    assert.ok(Math.abs(spentSoFar(records) - 0.027) < 1e-12);
    rmSync(dir, { recursive: true });
  });
});

// --- The committed corpus ----------------------------------------------------------------------

describe("evals/postings", () => {
  const corpusPath = join(ROOT, "evals", "postings", "corpus.jsonl");
  const present = existsSync(corpusPath) || existsSync(`${corpusPath}.gz`);

  // The corpus is git-ignored (other companies' text in a public repo), so a
  // fresh clone has none until `npm run postings:fetch` builds it.
  test("the corpus is there", { skip: !present && "not fetched; run npm run postings:fetch" }, () =>
    assert.ok(present),
  );

  test("every posting is well formed, unique and long enough", { skip: !present }, () => {
    const { postings } = readCorpus(corpusPath);
    assert.ok(postings.length >= 300 && postings.length <= 520, String(postings.length));
    assert.equal(new Set(postings.map((p) => p.id)).size, postings.length);
    for (const p of postings) {
      for (const field of ["id", "company", "title", "url", "source", "fetchedAt", "text", "control"]) {
        assert.ok(p[field], `${p.id} has no ${field}`);
      }
      assert.ok(["none", "near-miss", "mismatch"].includes(p.control), p.id);
      assert.ok(p.control === "mismatch" || p.family, `${p.id} has no family`);
      assert.ok(p.text.length >= 800, p.id);
      assert.equal(p.cutBySite, p.text.length > MAX_POSTING_TEXT, p.id);
      assert.ok(!/<[a-z][^>]*>/i.test(p.text.slice(0, 2000)), `${p.id} still has markup`);
    }
  });

  test("controls are about 10% mismatch and 5% near miss", { skip: !present }, () => {
    const { postings } = readCorpus(corpusPath);
    const share = (c) => postings.filter((p) => p.control === c).length / postings.length;
    assert.ok(Math.abs(share("mismatch") - 0.1) < 0.03, String(share("mismatch")));
    assert.ok(Math.abs(share("near-miss") - 0.05) < 0.03, String(share("near-miss")));
  });

  test("mine.jsonl is the empty slot it's documented as, or valid postings", () => {
    const mine = join(ROOT, "evals", "postings", "mine.jsonl");
    assert.ok(existsSync(mine));
    if (readFileSync(mine, "utf8").trim()) assert.ok(readCorpus(mine).postings.length > 0);
  });

  test("run results stay out of git", () => {
    assert.match(readFileSync(join(ROOT, "evals", "postings", "runs", ".gitignore"), "utf8"), /^\*$/m);
  });
});
