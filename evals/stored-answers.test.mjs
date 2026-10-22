// Stored answers for the site's own fixed questions (lib/stored-answers.ts).
//
// A replay is served to people who didn't trigger the generation, so the
// tests here are about what may never be stored or served:
//
//   1. ONLY FIXED QUESTIONS, ONLY OPENING A CONVERSATION. Anything a visitor
//      typed, any follow-up, anything with history is never a key.
//   2. THE KEY MOVES WITH WHAT PRODUCED THE ANSWER: model, system prompt,
//      question, deployment.
//   3. ONLY CLEAN ANSWERS ARE KEPT. An error, an empty turn, or a sentence the
//      citation checker would mark keeps the answer out of the store.
//   4. THE RECORDING IS THE STREAM, MINUS WHAT A REPLAY CAN'T USE. The browser
//      still gets every chunk untouched.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  FIXED_QUESTIONS,
  fixedQuestionOf,
  keptChunk,
  recorder,
  storable,
  storedAnswerKey,
  textOfChunks,
} from "../lib/stored-answers.ts";
import { SUGGESTED_QUESTIONS } from "../content/recruiter.ts";
import { ROAST_REQUEST, SITE_REQUEST } from "../lib/site-question.ts";

const user = (text) => ({ role: "user", parts: [{ type: "text", text }] });

describe("which conversations qualify", () => {
  test("every chip and fixed slash command is a fixed question", () => {
    for (const q of [...SUGGESTED_QUESTIONS, SITE_REQUEST, ROAST_REQUEST]) {
      assert.ok(FIXED_QUESTIONS.has(q), q);
      assert.equal(fixedQuestionOf([user(q)]), q);
    }
  });

  test("a typed question never qualifies, however close", () => {
    assert.equal(fixedQuestionOf([user("Is he a fit for a GTM engineering role?")]), null);
    assert.equal(fixedQuestionOf([user(` ${SUGGESTED_QUESTIONS[0]}`)]), null);
    assert.equal(fixedQuestionOf([user(SUGGESTED_QUESTIONS[0].toLowerCase())]), null);
  });

  test("only the opening turn: a chip asked as a follow-up is not looked up", () => {
    const q = SUGGESTED_QUESTIONS[0];
    const history = [
      user("What did he do at Dell?"),
      { role: "assistant", parts: [{ type: "text", text: "A propensity model." }] },
      user(q),
    ];
    assert.equal(fixedQuestionOf(history), null);
  });

  test("a message with more than the one text part is not a chip", () => {
    const q = SUGGESTED_QUESTIONS[0];
    assert.equal(
      fixedQuestionOf([{ role: "user", parts: [{ type: "text", text: q }, { type: "text", text: "and" }] }]),
      null,
    );
    assert.equal(
      fixedQuestionOf([{ role: "user", parts: [{ type: "file", url: "x" }] }]),
      null,
    );
    assert.equal(fixedQuestionOf([{ role: "assistant", parts: [{ type: "text", text: q }] }]), null);
  });
});

describe("the key", () => {
  const base = { model: "openai/gpt-6-luna", systemPrompt: "prompt", question: "q" };

  test("changes with the model, the system prompt and the question", () => {
    const key = storedAnswerKey(base);
    assert.notEqual(storedAnswerKey({ ...base, model: "anthropic/claude-haiku-5.5" }), key);
    assert.notEqual(storedAnswerKey({ ...base, systemPrompt: "prompt " }), key);
    assert.notEqual(storedAnswerKey({ ...base, question: "q?" }), key);
    assert.equal(storedAnswerKey({ ...base }), key);
  });

  test("changes with the deployment", () => {
    const before = process.env.VERCEL_DEPLOYMENT_ID;
    try {
      process.env.VERCEL_DEPLOYMENT_ID = "dpl_one";
      const one = storedAnswerKey(base);
      process.env.VERCEL_DEPLOYMENT_ID = "dpl_two";
      assert.notEqual(storedAnswerKey(base), one);
    } finally {
      if (before === undefined) delete process.env.VERCEL_DEPLOYMENT_ID;
      else process.env.VERCEL_DEPLOYMENT_ID = before;
    }
  });
});

describe("what is kept", () => {
  const lookup = {
    "resume:nokia": {
      id: "resume:nokia",
      text: "Migrated all sales reporting from Salesforce Analytics to Power BI for 150+ users.",
    },
  };
  const textTurn = (text) => [
    { type: "start-step" },
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: text },
    { type: "text-end", id: "t" },
    { type: "finish-step" },
  ];

  test("an answer whose every claim is in the chunk it cites is kept", () => {
    assert.equal(
      storable(textTurn("He moved sales reporting for 150+ users to Power BI [resume:nokia]."), lookup),
      true,
    );
  });

  test("a number the cited chunk doesn't hold keeps the answer out", () => {
    assert.equal(
      storable(textTurn("He moved sales reporting for 300+ users to Power BI [resume:nokia]."), lookup),
      false,
    );
  });

  test("a citation to a chunk that doesn't exist keeps the answer out", () => {
    assert.equal(
      storable(textTurn("He moved sales reporting to Power BI [resume:invented]."), lookup),
      false,
    );
  });

  test("an empty turn, or one with an error chunk, is never kept", () => {
    assert.equal(storable(textTurn("   "), lookup), false);
    assert.equal(
      storable([...textTurn("Fine [resume:nokia]."), { type: "error", errorText: "x" }], lookup),
      false,
    );
    assert.equal(
      storable([...textTurn("Fine."), { type: "tool-output-error", toolCallId: "c", errorText: "x" }], lookup),
      false,
    );
  });
});

describe("the recording", () => {
  test("drops reasoning and tool-input deltas, and strips provider metadata", () => {
    assert.equal(keptChunk({ type: "reasoning-delta", id: "r", delta: "hm" }), null);
    assert.equal(keptChunk({ type: "tool-input-delta", toolCallId: "c", inputTextDelta: "{" }), null);
    assert.deepEqual(
      keptChunk({ type: "text-start", id: "t", providerMetadata: { openai: { itemId: "msg_1" } } }),
      { type: "text-start", id: "t" },
    );
    const output = { type: "tool-output-available", toolCallId: "c", output: { slug: "nokia" } };
    assert.equal(keptChunk(output), output);
  });

  test("passes every chunk through untouched and keeps a joined copy", async () => {
    const { transform, done } = recorder();
    const sent = [
      { type: "start-step" },
      { type: "reasoning-delta", id: "r", delta: "thinking" },
      { type: "text-start", id: "t", providerMetadata: { openai: { itemId: "msg_1" } } },
      { type: "text-delta", id: "t", delta: "He " },
      { type: "text-delta", id: "t", delta: "built " },
      { type: "text-delta", id: "t", delta: "it." },
      { type: "text-end", id: "t" },
      { type: "finish-step" },
    ];
    const source = new ReadableStream({
      start(controller) {
        for (const chunk of sent) controller.enqueue(chunk);
        controller.close();
      },
    });
    const received = [];
    for await (const chunk of source.pipeThrough(transform)) received.push(chunk);

    assert.deepEqual(received, sent);
    const kept = await done;
    assert.deepEqual(kept, [
      { type: "start-step" },
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: "He built it." },
      { type: "text-end", id: "t" },
      { type: "finish-step" },
    ]);
    assert.equal(textOfChunks(kept), "He built it.");
  });
});
