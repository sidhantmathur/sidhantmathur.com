// The consistent fit check through the real chat route, with a mocked model.
//
// app/api/chat/route.ts is loaded as it ships (evals/lib/ts-paths.mjs resolves
// its `@/` imports), and every model call goes to the AI SDK's own test model
// (`ai/test`), installed as the SDK's default provider: the route asks for its
// model by catalogue id, and the SDK resolves a bare id through
// `globalThis.AI_SDK_DEFAULT_PROVIDER`. Nothing is stubbed inside the route.
//
// Offline by construction. The key below is a placeholder the route checks for
// presence, `fetch` is replaced with one that throws, and the mock provider
// answers every call, so a request that tried to leave this process would fail
// the test rather than reach the Gateway.
//
// What is held here:
//   - the extra assessments start beside the turn's own judging step, from its
//     exact prompt, tools, choice, ceiling and reasoning level
//   - the card is the per-row consensus, and the summary step reads it
//   - the stream stays alive while the card waits, and says how many are in
//   - the cost record carries every assessment, and a visitor turn is one
//   - a turn that isn't a posting runs one assessment, exactly as before
//   - a stalled assessment is given up on after the grace, and billed high

import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";

import { importFromRoot } from "./lib/ts-paths.mjs";
import { MockLanguageModelV4, MockProviderV4, simulateReadableStream } from "ai/test";
import { tool } from "ai";
import { z } from "zod";
import { JD_PREFIX } from "../lib/job-posting.ts";
import { DEFAULT_MODEL, HOURLY_LIMIT } from "../lib/models.ts";
import { CONSISTENCY_SAMPLES, forModel } from "../lib/consistency.ts";
import { ROLE_FIT } from "./cases.mjs";

const POSTING = `${JD_PREFIX}\n\n${ROLE_FIT.find((c) => c.id === "revops-strong-fit").posting}`;
const REQS = [
  "3+ years in revenue operations, sales operations, or business analytics",
  "Strong SQL and experience building executive-facing dashboards",
  "Experience with Salesforce and a BI tool (Looker, Power BI, or Tableau)",
  "Comfortable translating vague requests from sales leadership into scoped work",
];

const row = (requirement, verdict, evidence, sources = []) => ({ requirement, verdict, evidence, sources });

// Three assessments of the same list that disagree on two rows: the turn's own
// says SQL is met, the others partial; the BI row is met by two and unmet by one.
const OWN = {
  role: "Revenue Operations Analyst",
  rows: [
    row(REQS[0], "met", "Sales operations at Nokia since 2024.", ["resume:nokia"]),
    row(REQS[1], "met", "SQL and DAX modeling at Nokia.", ["resume:nokia"]),
    row(REQS[2], "met", "Salesforce CRM Analytics dashboards at Nokia.", ["resume:nokia"]),
    row(REQS[3], "met", "Turns leadership requests into scoped requirements.", ["resume:nokia"]),
  ],
  verdict: "The turn's own line.",
  gaps: [],
};
const SECOND = {
  ...OWN,
  rows: [OWN.rows[0], row(REQS[1], "partial", "Some SQL at Nokia.", ["resume:nokia"]), OWN.rows[2], OWN.rows[3]],
  verdict: "The second line.",
};
const THIRD = {
  ...OWN,
  rows: [
    OWN.rows[0],
    row(REQS[1], "partial", "SQL at Nokia.", ["resume:nokia"]),
    row(REQS[2], "unmet", "No BI tool named."),
    OWN.rows[3],
  ],
  verdict: "The third line.",
  gaps: ["No BI tool named"],
};

const usage = (input, cached, output, reasoning = 0) => ({
  inputTokens: { total: input, noCache: input - cached, cacheRead: cached, cacheWrite: 0 },
  outputTokens: { total: output, text: output - reasoning, reasoning },
});
const STEP_USAGE = {
  extract: usage(6000, 5000, 300),
  judge: usage(6500, 5000, 1500, 100),
  summary: usage(8000, 6000, 200),
  sample: usage(6500, 4000, 1400, 80),
};

function toolCallStream(id, toolName, input, finishUsage, chunkDelayInMs = 0) {
  const json = JSON.stringify(input);
  const half = Math.ceil(json.length / 2);
  return {
    stream: simulateReadableStream({
      chunkDelayInMs,
      chunks: [
        { type: "stream-start", warnings: [] },
        { type: "tool-input-start", id, toolName },
        { type: "tool-input-delta", id, delta: json.slice(0, half) },
        { type: "tool-input-delta", id, delta: json.slice(half) },
        { type: "tool-input-end", id },
        { type: "tool-call", toolCallId: id, toolName, input: json },
        { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage: finishUsage },
      ],
    }),
  };
}

function textStream(text, finishUsage) {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: text },
        { type: "text-end", id: "t" },
        { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: finishUsage },
      ],
    }),
  };
}

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    });
  });

/**
 * A model that plays a posting turn: extraction, then the turn's own
 * assessment, then the summary, on the stream; the extra assessments arrive
 * through doGenerate, which only they use.
 */
function postingModel({ samples = [SECOND, THIRD], sampleDelayMs = 40, judgeDelayMs = 0, failSample = -1, hangSample = -1 } = {}) {
  const events = [];
  let sampleIndex = 0;
  const model = new MockLanguageModelV4({
    provider: "mock",
    modelId: DEFAULT_MODEL,
    doStream: async (options) => {
      const choice = options.toolChoice;
      if (choice?.type === "tool" && choice.toolName === "extractRequirements") {
        events.push(["extract", Date.now()]);
        return toolCallStream("call-extract", "extractRequirements", { role: OWN.role, requirements: REQS }, STEP_USAGE.extract);
      }
      if (choice?.type === "tool" && choice.toolName === "roleFit") {
        events.push(["judge:start", Date.now()]);
        const result = toolCallStream("call-fit", "roleFit", OWN, STEP_USAGE.judge, judgeDelayMs);
        return result;
      }
      events.push(["summary", Date.now()]);
      return textStream("His strongest matches are reporting and scoping work.", STEP_USAGE.summary);
    },
    doGenerate: async (options) => {
      const i = sampleIndex++;
      events.push([`sample:${i}:start`, Date.now()]);
      if (i === hangSample) {
        await wait(60_000, options.abortSignal);
      }
      await wait(sampleDelayMs, options.abortSignal);
      if (i === failSample) throw new Error("provider 500");
      events.push([`sample:${i}:end`, Date.now()]);
      return {
        content: [
          { type: "tool-call", toolCallId: `call-sample-${i}`, toolName: "roleFit", input: JSON.stringify(samples[i % samples.length]) },
        ],
        finishReason: { unified: "tool-calls", raw: "tool_calls" },
        usage: STEP_USAGE.sample,
        warnings: [],
      };
    },
  });
  return { model, events };
}

/** A model that answers a named-role question: roleFit on its own, then prose. */
function questionModel() {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId: DEFAULT_MODEL,
    doStream: async (options) => {
      const answered = options.prompt.some((m) => m.role === "tool");
      if (!answered) {
        return toolCallStream("call-fit", "roleFit", { ...OWN, rows: OWN.rows.slice(0, 2) }, STEP_USAGE.judge);
      }
      return textStream("He fits the reporting half.", STEP_USAGE.summary);
    },
    doGenerate: async () => {
      throw new Error("a question turn must not start extra assessments");
    },
  });
}

let POST;
let ip = 0;
const realFetch = globalThis.fetch;

before(async () => {
  // The route checks that a key exists before it calls a model. This is not
  // one, and nothing below can reach a network to use it.
  process.env.AI_GATEWAY_API_KEY = "offline-test-placeholder";
  globalThis.fetch = async () => {
    throw new Error("network access in an offline test");
  };
  ({ POST } = await importFromRoot("app/api/chat/route.ts"));
});

after(() => {
  globalThis.fetch = realFetch;
  delete globalThis.AI_SDK_DEFAULT_PROVIDER;
});

function useModel(model) {
  globalThis.AI_SDK_DEFAULT_PROVIDER = new MockProviderV4({ languageModels: { [DEFAULT_MODEL]: model } });
}

/** One turn through the route: its headers and every chunk on the stream. */
async function turn(text) {
  ip += 1;
  const res = await POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${ip}` },
      body: JSON.stringify({ messages: [{ id: "u1", role: "user", parts: [{ type: "text", text }] }] }),
    }),
  );
  const body = await res.text();
  const chunks = body
    .split("\n")
    .filter((l) => l.startsWith("data: ") && l !== "data: [DONE]")
    .map((l) => JSON.parse(l.slice(6)));
  return { res, chunks };
}

const fitOutput = (chunks) =>
  chunks.find((c) => c.type === "tool-output-available" && c.toolCallId === "call-fit")?.output;
const closingRecord = (chunks) => chunks.filter((c) => c.type === "data-turn").at(-1)?.data;
const sumUsage = (...us) => ({
  input: us.reduce((s, u) => s + u.inputTokens.total, 0),
  cached: us.reduce((s, u) => s + u.inputTokens.cacheRead, 0),
  output: us.reduce((s, u) => s + u.outputTokens.total, 0),
  reasoning: us.reduce((s, u) => s + u.outputTokens.reasoning, 0),
});

describe("a posting turn through the route", () => {
  test("the card is the per-row consensus of every assessment", async () => {
    const { model } = postingModel();
    useModel(model);
    const { res, chunks } = await turn(POSTING);
    assert.equal(res.status, 200);

    const fit = fitOutput(chunks);
    assert.ok(fit, "no roleFit card on the stream");
    assert.equal(fit.samples, CONSISTENCY_SAMPLES);
    assert.deepEqual(
      fit.rows.map((r) => r.verdict),
      ["met", "partial", "unclear", "met"],
      "SQL is partial two to one, and met against unmet on the BI row is unclear",
    );
    assert.deepEqual(fit.rows[1].agreement, { met: 1, partial: 2 });
    assert.deepEqual(fit.rows[2].agreement, { met: 2, unmet: 1 });
    assert.equal(fit.rows[0].agreement, undefined);
    assert.equal(model.doGenerateCalls.length, CONSISTENCY_SAMPLES - 1);
  });

  test("each extra assessment is the turn's own judging step again, from the same prompt", async () => {
    const { model } = postingModel();
    useModel(model);
    await turn(POSTING);
    const judge = model.doStreamCalls.find((c) => c.toolChoice?.toolName === "roleFit");
    assert.ok(judge);
    for (const sample of model.doGenerateCalls) {
      assert.deepEqual(sample.prompt, judge.prompt, "a sample saw a different conversation");
      assert.deepEqual(sample.toolChoice, judge.toolChoice);
      assert.deepEqual(
        sample.tools.map((t) => [t.name, t.inputSchema]),
        judge.tools.map((t) => [t.name, t.inputSchema]),
        "a sample saw different tools",
      );
      assert.equal(sample.maxOutputTokens, judge.maxOutputTokens);
      assert.equal(sample.reasoning, judge.reasoning, "a sample thought at a different level");
      assert.ok(sample.abortSignal, "a sample can't be stopped with the turn");
    }
    assert.equal(judge.reasoning, "low", "the default's posting-turn level from the catalogue");
  });

  test("they start beside the turn's own assessment, not after it", async () => {
    const { model, events } = postingModel({ judgeDelayMs: 25, sampleDelayMs: 10 });
    useModel(model);
    const { chunks } = await turn(POSTING);
    const at = (name) => events.find(([e]) => e === name)?.[1];
    const judgeStart = at("judge:start");
    assert.ok(judgeStart != null && at("sample:0:start") != null);
    assert.ok(at("sample:0:start") - judgeStart < 20, "the samples waited for the turn's own assessment");
    // The turn's own call streams for ~150 ms; both samples finish inside it,
    // so the card waits for nothing and no progress is written.
    assert.ok(at("sample:1:end") <= at("summary"));
    assert.ok(!chunks.some((c) => c.type === "data-samples"), "progress written with nothing to wait for");
  });

  test("while the card waits, the stream says how many are in, under one part id", async () => {
    const { model } = postingModel({ sampleDelayMs: 120 });
    useModel(model);
    const { chunks } = await turn(POSTING);
    const types = chunks.map((c) => c.type);
    const progress = chunks.filter((c) => c.type === "data-samples");
    assert.ok(progress.length >= 1, "the wait was silent");
    assert.ok(progress.every((c) => c.id === "samples"), "progress parts would pile up on the message");
    assert.deepEqual(progress[0].data, { done: 1, of: CONSISTENCY_SAMPLES });
    assert.equal(progress.at(-1).data.of, CONSISTENCY_SAMPLES);
    // In the gap between the call and its result, nowhere else.
    const inputAt = types.indexOf("tool-input-available", types.lastIndexOf("tool-input-start"));
    const outputAt = chunks.findIndex((c) => c.type === "tool-output-available" && c.toolCallId === "call-fit");
    for (const c of progress) {
      const i = chunks.indexOf(c);
      assert.ok(i > inputAt && i < outputAt, "progress outside the wait");
    }
  });

  test("the summary step reads the merged table, without the vote counts", async () => {
    const { model } = postingModel();
    useModel(model);
    const { chunks } = await turn(POSTING);
    const summary = model.doStreamCalls.at(-1);
    assert.equal(summary.toolChoice?.type, "none");
    const result = summary.prompt
      .filter((m) => m.role === "tool")
      .flatMap((m) => m.content)
      .find((p) => p.type === "tool-result" && p.toolName === "roleFit");
    assert.ok(result, "the summary step never saw the table");
    assert.equal(result.output.type, "json");
    assert.deepEqual(result.output.value, forModel(fitOutput(chunks)));
    assert.deepEqual(
      result.output.value.rows.map((r) => r.verdict),
      ["met", "partial", "unclear", "met"],
      "the summary read the turn's own verdicts, not the reader's",
    );
    assert.ok(result.output.value.rows.every((r) => !("agreement" in r)));
  });

  test("the cost record counts every assessment, and the visitor spent one turn", async () => {
    const { model } = postingModel();
    useModel(model);
    const { res, chunks } = await turn(POSTING);
    assert.equal(res.headers.get("x-budget-remaining"), String(HOURLY_LIMIT - 1));

    const record = closingRecord(chunks);
    const own = sumUsage(STEP_USAGE.extract, STEP_USAGE.judge, STEP_USAGE.summary);
    const extra = sumUsage(STEP_USAGE.sample, STEP_USAGE.sample);
    assert.equal(record.usage.inputTokens, own.input + extra.input);
    assert.equal(record.usage.cachedInputTokens, own.cached + extra.cached);
    assert.equal(record.usage.outputTokens, own.output + extra.output);
    assert.equal(record.usage.reasoningTokens, own.reasoning + extra.reasoning);
    assert.deepEqual(record.consistency.extraUsage.outputTokens, extra.output);
    assert.equal(record.consistency.requested, CONSISTENCY_SAMPLES);
    assert.equal(record.consistency.merged, CONSISTENCY_SAMPLES);
    assert.equal(record.consistency.estimated, 0);
    assert.equal(record.consistency.sampleMs.length, CONSISTENCY_SAMPLES - 1);
    // The reader's stream is what tokens per second describes.
    assert.deepEqual(record.toolsCalled, ["extractRequirements", "roleFit"]);
    assert.equal(record.error, null);
  });

  test("a failed assessment is left out of the vote and billed at its ceiling", async () => {
    const { model } = postingModel({ failSample: 1 });
    useModel(model);
    const { chunks } = await turn(POSTING);
    const fit = fitOutput(chunks);
    // The turn's own and the second: SQL met against partial has no majority.
    assert.equal(fit.samples, 2);
    assert.equal(fit.rows[1].verdict, "unclear");
    assert.deepEqual(fit.rows[1].agreement, { met: 1, partial: 1 });

    const record = closingRecord(chunks);
    const judge = model.doStreamCalls.find((c) => c.toolChoice?.toolName === "roleFit");
    assert.equal(record.consistency.merged, 2);
    assert.equal(record.consistency.estimated, 1);
    const own = sumUsage(STEP_USAGE.extract, STEP_USAGE.judge, STEP_USAGE.summary);
    assert.equal(
      record.usage.outputTokens,
      own.output + STEP_USAGE.sample.outputTokens.total + judge.maxOutputTokens,
      "the failed assessment wasn't counted at the output ceiling",
    );
    assert.equal(
      record.usage.inputTokens,
      own.input + STEP_USAGE.sample.inputTokens.total + STEP_USAGE.judge.inputTokens.total,
    );
  });
});

describe("a turn that isn't a posting", () => {
  test("runs one assessment, exactly as before: no samples, no progress, no record of them", async () => {
    const model = questionModel();
    useModel(model);
    const { chunks } = await turn("Is he a fit for a solutions engineering role?");
    const fit = fitOutput(chunks);
    assert.ok(fit, "no card");
    assert.ok(!("samples" in fit));
    assert.ok(fit.rows.every((r) => !("agreement" in r)));
    assert.equal(model.doGenerateCalls.length, 0);
    assert.ok(!chunks.some((c) => c.type === "data-samples"));
    const record = closingRecord(chunks);
    assert.ok(!("consistency" in record), "a single assessment grew a consistency record");
    assert.equal(record.jobPosting, false);
  });
});

describe("the samples on their own", () => {
  const ROLE_FIT_TOOL = tool({
    description: "Assess.",
    inputSchema: z.object({ role: z.string(), rows: z.array(z.any()), verdict: z.string(), gaps: z.array(z.string()) }),
  });
  const MESSAGES = [
    { role: "system", content: "system" },
    { role: "user", content: [{ type: "text", text: "posting" }] },
  ];

  test("a stalled one is given up on after the grace; the rest are kept", async () => {
    const { model } = postingModel({ hangSample: 1, sampleDelayMs: 5 });
    useModel(model);
    const { startFitSamples } = await importFromRoot("lib/fit-samples.ts");
    const samples = startFitSamples({
      count: 2,
      model: DEFAULT_MODEL,
      messages: MESSAGES,
      tools: { roleFit: ROLE_FIT_TOOL },
      maxOutputTokens: 4000,
    });
    const progress = [];
    const started = Date.now();
    const outcomes = await samples.collect({ graceMs: 120, heartbeatMs: 30, onProgress: (n) => progress.push(n) });
    assert.ok(Date.now() - started < 1000, "the grace didn't bound the wait");
    assert.equal(outcomes.length, 2);
    assert.equal(outcomes[0].failure, null);
    assert.ok(outcomes[0].input?.rows?.length);
    assert.equal(outcomes[1].failure, "aborted");
    assert.equal(outcomes[1].usage, null, "a run that never reported has no usage to show");
    assert.ok(progress.length >= 2, "no heartbeat while waiting");
    assert.ok(progress.every((n) => n <= 2));
    assert.equal(model.doGenerateCalls[1].abortSignal.aborted, true, "the straggler kept running");
    assert.strictEqual(samples.finish(), samples.finish(), "finish is not idempotent");
    assert.deepEqual(samples.finish(), outcomes);
  });

  test("stopping the turn stops them", async () => {
    const { model } = postingModel({ sampleDelayMs: 5_000 });
    useModel(model);
    const { startFitSamples } = await importFromRoot("lib/fit-samples.ts");
    const stop = new AbortController();
    const samples = startFitSamples({
      count: 2,
      model: DEFAULT_MODEL,
      messages: MESSAGES,
      tools: { roleFit: ROLE_FIT_TOOL },
      maxOutputTokens: 4000,
      abortSignal: stop.signal,
    });
    stop.abort();
    const outcomes = await samples.collect({ graceMs: 5_000, heartbeatMs: 1_000, onProgress: () => {} });
    assert.deepEqual(outcomes.map((o) => o.failure), ["aborted", "aborted"]);
  });

  test("none to start is no sampler at all", async () => {
    const { startFitSamples } = await importFromRoot("lib/fit-samples.ts");
    const args = { model: DEFAULT_MODEL, messages: MESSAGES, tools: {}, maxOutputTokens: 4000 };
    for (const count of [0, -1, 1.5, Number.NaN]) {
      assert.equal(startFitSamples({ ...args, count }), null, `count ${count}`);
    }
  });

  test("the extra assessments never run the tool they're judging with", async () => {
    const { definitionsOnly } = await importFromRoot("lib/fit-samples.ts");
    const defs = definitionsOnly({ roleFit: { ...ROLE_FIT_TOOL, execute: async () => "ran" }, other: ROLE_FIT_TOOL });
    assert.deepEqual(Object.keys(defs), ["roleFit", "other"]);
    assert.ok(Object.values(defs).every((t) => !("execute" in t)));
    assert.equal(defs.roleFit.description, "Assess.");
  });
});
