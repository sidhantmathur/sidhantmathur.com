// Unit tests for the guarded fetch — the decorator every chat turn goes
// through on its way to /api/chat.
//
// Everything here used to be unreachable from a test: it lived inside a React
// hook, closed over the real `fetch` and over two timeouts measured in tens of
// seconds. The module now takes both as dependencies, so a scripted fetch and
// single-digit-millisecond clocks can drive the same code the browser runs.
//
// The assertions that matter most are the abort ones. An aborted turn must
// render NOTHING, and the two ways that broke in production — a wifi drop
// reported as a server fault, and the stop button producing an error block
// about one run in five — are the reason classifyStreamError exists at all.
//
// Run: npm run eval

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { guardedFetch, TurnFailure } from "../lib/chat-transport.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A response whose body is driven by hand: `push`, `close` and `fail` are the
 * server, and nothing arrives until the test says so.
 */
function scriptedBody(init = {}) {
  let controller;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(stream, init),
    push: (text) => controller.enqueue(enc.encode(text)),
    close: () => controller.close(),
    fail: (err) => controller.error(err),
  };
}

/** Reads a whole body, returning the chunks in order. Rejects as the body does. */
async function drain(res) {
  const reader = res.body.getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(dec.decode(value));
  }
  return chunks;
}

/** The error a call threw, or a sentinel if it did not throw at all. */
async function thrownBy(fn) {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  return { name: "__did_not_throw__" };
}

describe("the idle clock on a stream", () => {
  test("a stream that goes quiet fails with upstream_timeout instead of hanging", async () => {
    // The reported failure: iOS Safari suspends the tab, the connection is
    // established, and then nothing ever arrives again.
    const script = scriptedBody();
    const gf = guardedFetch({
      fetch: async () => script.response,
      idleTimeoutMs: 5,
    });

    const res = await gf("/api/chat");
    script.push("first");

    const err = await thrownBy(() => drain(res));
    assert.ok(err instanceof TurnFailure, `expected a TurnFailure, got ${err.name}`);
    assert.equal(err.cls, "upstream_timeout");
    // The message is still the class string, for anything reading it that way.
    assert.equal(err.message, "upstream_timeout");
  });

  test("chunks inside the window keep the stream alive and arrive in order", async () => {
    const script = scriptedBody();
    const gf = guardedFetch({
      fetch: async () => script.response,
      idleTimeoutMs: 60,
    });

    const res = await gf("/api/chat");
    void (async () => {
      for (const word of ["a", "b", "c", "d"]) {
        await sleep(5);
        script.push(word);
      }
      await sleep(5);
      script.close();
    })();

    assert.deepEqual(await drain(res), ["a", "b", "c", "d"]);
  });

  test("the clock is per-chunk, not per-stream", async () => {
    // A healthy job-posting turn runs past a minute across three model steps.
    // A total-duration abort would kill it mid-answer, which is why there
    // isn't one.
    const script = scriptedBody();
    const gf = guardedFetch({
      fetch: async () => script.response,
      idleTimeoutMs: 20,
    });

    const res = await gf("/api/chat");
    void (async () => {
      for (let i = 0; i < 12; i++) {
        await sleep(5);
        script.push(String(i));
      }
      script.close();
    })();

    const chunks = await drain(res);
    assert.equal(chunks.length, 12);
  });
});

describe("the connect clock", () => {
  test("headers that never arrive produce upstream_timeout", async () => {
    const gf = guardedFetch({
      // Answers only when aborted — the shape of a request that is gone.
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(new DOMException("The operation was aborted.", "AbortError")),
            { once: true },
          );
        }),
      connectTimeoutMs: 5,
    });

    const err = await thrownBy(() => gf("/api/chat"));
    assert.ok(err instanceof TurnFailure);
    assert.equal(err.cls, "upstream_timeout");
  });

  test("a dead network is `network`, not `unknown`", async () => {
    // Safari says "Load failed", Chrome and Firefox say "Failed to fetch"; all
    // three raise a TypeError. `unknown` copy would have the site apologising
    // for the visitor's train going into a tunnel.
    const gf = guardedFetch({
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });

    const err = await thrownBy(() => gf("/api/chat"));
    assert.ok(err instanceof TurnFailure);
    assert.equal(err.cls, "network");
  });
});

describe("an aborted turn renders nothing", () => {
  test("a signal that is already aborted surfaces an AbortError", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const gf = guardedFetch({
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          if (init.signal.aborted) {
            reject(new DOMException("The operation was aborted.", "AbortError"));
            return;
          }
          init.signal.addEventListener(
            "abort",
            () => reject(new DOMException("The operation was aborted.", "AbortError")),
            { once: true },
          );
        }),
    });

    const err = await thrownBy(() => gf("/api/chat", { signal: ctrl.signal }));
    assert.equal(err.name, "AbortError");
    assert.ok(!(err instanceof TurnFailure), "an abort must never become a turn failure");
  });

  test("aborting mid-stream surfaces an AbortError, not a network failure", async () => {
    // The one-run-in-five bug. Tearing a stream down raises a clean AbortError
    // on some browsers and a TypeError from the dying socket on others, so the
    // shape of the error is the wrong thing to read — the caller's signal is
    // the authority.
    for (const raised of [
      new DOMException("The operation was aborted.", "AbortError"),
      new TypeError("Load failed"),
    ]) {
      const script = scriptedBody();
      const ctrl = new AbortController();
      const gf = guardedFetch({
        fetch: async () => script.response,
        idleTimeoutMs: 500,
      });

      const res = await gf("/api/chat", { signal: ctrl.signal });
      script.push("half an answer");
      void (async () => {
        await sleep(5);
        ctrl.abort();
        script.fail(raised);
      })();

      const err = await thrownBy(() => drain(res));
      assert.equal(err.name, "AbortError", `${raised.name} mid-abort should read as AbortError`);
      assert.ok(!(err instanceof TurnFailure), "an abort must never become a turn failure");
    }
  });

  test("a TypeError with no abort behind it is still a network failure", async () => {
    // The other half of the same rule: without an aborted signal, a socket
    // dying mid-answer is the visitor's connection and should say so.
    const script = scriptedBody();
    const gf = guardedFetch({ fetch: async () => script.response, idleTimeoutMs: 500 });

    const res = await gf("/api/chat");
    script.push("half an answer");
    void (async () => {
      await sleep(5);
      script.fail(new TypeError("Load failed"));
    })();

    const err = await thrownBy(() => drain(res));
    assert.ok(err instanceof TurnFailure);
    assert.equal(err.cls, "network");
  });
});

describe("an error response becomes a class", () => {
  test("429 is rate_limited", async () => {
    const gf = guardedFetch({
      fetch: async () => new Response("slow down", { status: 429 }),
    });
    const err = await thrownBy(() => gf("/api/chat"));
    assert.ok(err instanceof TurnFailure);
    assert.equal(err.cls, "rate_limited");
  });

  test("any other error status is upstream_unavailable", async () => {
    const gf = guardedFetch({
      fetch: async () => new Response("<html>bad gateway</html>", { status: 502 }),
    });
    const err = await thrownBy(() => gf("/api/chat"));
    assert.equal(err.cls, "upstream_unavailable");
  });

  test("a JSON body naming a class wins over the status", async () => {
    const gf = guardedFetch({
      fetch: async () =>
        new Response(JSON.stringify({ error: "upstream_auth" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    });
    const err = await thrownBy(() => gf("/api/chat"));
    assert.equal(err.cls, "upstream_auth");
  });

  test("a class the vocabulary doesn't know falls back to unknown", async () => {
    const gf = guardedFetch({
      fetch: async () =>
        new Response(JSON.stringify({ error: "the_dog_ate_it" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    });
    const err = await thrownBy(() => gf("/api/chat"));
    assert.equal(err.cls, "unknown");
  });
});

describe("the budget lifted out of the response headers", () => {
  const withHeaders = (headers) =>
    scriptedBody({ status: 200, headers }).response;

  test("a complete budget pair fires onBudget with parsed numbers", async () => {
    const seen = [];
    const gf = guardedFetch({
      fetch: async () => withHeaders({ "x-budget-remaining": "3", "x-budget-limit": "10" }),
      onBudget: (b) => seen.push(b),
      idleTimeoutMs: 500,
    });

    await gf("/api/chat");
    assert.deepEqual(seen, [{ remaining: 3, limit: 10 }]);
  });

  test("a missing count is not read as zero", async () => {
    // Number(null) is 0, and 0 is finite. Without the presence check this
    // reported "0/10 left" for a response that said nothing about the count.
    const seen = [];
    const gf = guardedFetch({
      fetch: async () => withHeaders({ "x-budget-limit": "10" }),
      onBudget: (b) => seen.push(b),
      idleTimeoutMs: 500,
    });

    await gf("/api/chat");
    assert.deepEqual(seen, []);
  });

  test("missing headers fire nothing", async () => {
    const seen = [];
    const gf = guardedFetch({
      fetch: async () => withHeaders({}),
      onBudget: (b) => seen.push(b),
      idleTimeoutMs: 500,
    });

    await gf("/api/chat");
    assert.deepEqual(seen, []);
  });

  test("a non-numeric count fires nothing rather than a NaN budget", async () => {
    const seen = [];
    const gf = guardedFetch({
      fetch: async () =>
        withHeaders({ "x-budget-remaining": "lots", "x-budget-limit": "10" }),
      onBudget: (b) => seen.push(b),
      idleTimeoutMs: 500,
    });

    await gf("/api/chat");
    assert.deepEqual(seen, []);
  });
});

describe("rewrapping the stream keeps the response intact", () => {
  test("status, statusText and headers all survive", async () => {
    // The body is replaced by a watched copy, so the response is rebuilt from
    // the original — the budget read is not the only thing that reads it.
    const script = scriptedBody({
      status: 200,
      statusText: "Streaming",
      headers: { "content-type": "text/event-stream", "x-vercel-id": "iad1::abc" },
    });
    const gf = guardedFetch({ fetch: async () => script.response, idleTimeoutMs: 500 });

    const res = await gf("/api/chat");
    assert.equal(res.status, 200);
    assert.equal(res.statusText, "Streaming");
    assert.equal(res.headers.get("content-type"), "text/event-stream");
    assert.equal(res.headers.get("x-vercel-id"), "iad1::abc");

    script.push("data: hello\n\n");
    script.close();
    assert.deepEqual(await drain(res), ["data: hello\n\n"]);
  });

  test("a response with no body is passed straight through", async () => {
    const gf = guardedFetch({ fetch: async () => new Response(null, { status: 204 }) });
    const res = await gf("/api/chat");
    assert.equal(res.status, 204);
    assert.equal(res.body, null);
  });
});

// --- A turn that finished having said nothing --------------------------------
//
// The failure reproduced on production on 2026-10-19: the default model, a
// reasoning model, spent the whole 600-token ceiling thinking about the RevOps
// chip and finished on "length" with no text and no tool call. The stream was
// clean, so nothing anywhere noticed — the shell said "ready" over an empty
// column. The transport now appends an error chunk to a complete turn with
// nothing visible in it, and these pin both halves of that: it fires on the
// empty turn in every shape it arrives in, and on nothing else.

/** One SSE frame, exactly as createUIMessageStreamResponse writes it. */
const sse = (chunk) => `data: ${JSON.stringify(chunk)}\n\n`;
const DONE = "data: [DONE]\n\n";

const opening = { type: "data-turn", id: "turn", data: { usage: null, error: null } };
const closing = { type: "data-turn", id: "turn", data: { usage: { outputTokens: 600 }, error: null } };

/** The stream the live repro recorded: reasoning, then finish, then nothing. */
const REASONED_OUT = [
  { type: "start" },
  opening,
  { type: "start-step" },
  { type: "reasoning-start", id: "r1" },
  { type: "reasoning-delta", id: "r1", delta: "The user asks whether he fits a RevOps role…" },
  { type: "reasoning-end", id: "r1" },
  { type: "finish-step" },
  closing,
  { type: "finish" },
];

/** Every SSE `data:` payload in a drained body, parsed, [DONE] skipped. */
function framesOf(chunks) {
  return chunks
    .join("")
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice(6)));
}

/** Plays a list of chunks through the guarded fetch and returns what came out. */
async function play(chunks, { split = false, signal } = {}) {
  const script = scriptedBody({ status: 200, headers: { "content-type": "text/event-stream" } });
  const gf = guardedFetch({ fetch: async () => script.response, idleTimeoutMs: 500 });
  const res = await gf("/api/chat", signal ? { signal } : undefined);
  const wire = chunks.map(sse).join("") + DONE;
  if (split) {
    // Network reads don't respect frame boundaries. Seven bytes at a time puts
    // a cut inside nearly every JSON payload.
    for (let i = 0; i < wire.length; i += 7) script.push(wire.slice(i, i + 7));
  } else {
    script.push(wire);
  }
  script.close();
  return framesOf(await drain(res));
}

const isEmptyAnswerChunk = (frame) =>
  frame?.type === "error" && frame.errorText === "empty_answer";

describe("a turn that finished having said nothing", () => {
  test("reasoning, then finish, ends in an empty_answer error chunk", async () => {
    const frames = await play(REASONED_OUT);
    assert.ok(isEmptyAnswerChunk(frames.at(-1)), "the last frame should be the empty_answer error");
    // Appended, never substituted: the closing record is still delivered, so
    // the turn's numbers reach the instruments.
    assert.deepEqual(frames.slice(0, REASONED_OUT.length), REASONED_OUT);
  });

  test("it holds when the reads cut frames in half", async () => {
    const frames = await play(REASONED_OUT, { split: true });
    assert.ok(isEmptyAnswerChunk(frames.at(-1)));
  });

  test("whitespace is not an answer", async () => {
    const chunks = [
      { type: "start" },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "\n  " },
      { type: "text-end", id: "t1" },
      { type: "finish" },
    ];
    assert.ok(isEmptyAnswerChunk((await play(chunks)).at(-1)));
  });

  test("a job-description turn that extracted and then stopped is empty", async () => {
    // Step 0 ran, step 1 reasoned itself out of room before calling roleFit.
    // The extraction has no surface of its own, so the reader saw nothing.
    const chunks = [
      { type: "start" },
      { type: "tool-input-start", toolCallId: "c1", toolName: "extractRequirements" },
      {
        type: "tool-input-available",
        toolCallId: "c1",
        toolName: "extractRequirements",
        input: { role: "GTM systems manager", requirements: ["Salesforce admin"] },
      },
      {
        type: "tool-output-available",
        toolCallId: "c1",
        output: { role: "GTM systems manager", requirements: ["Salesforce admin"] },
      },
      { type: "reasoning-start", id: "r1" },
      { type: "reasoning-delta", id: "r1", delta: "…" },
      { type: "reasoning-end", id: "r1" },
      { type: "finish" },
    ];
    assert.ok(isEmptyAnswerChunk((await play(chunks)).at(-1)));
  });

  test("a turn with text is left alone", async () => {
    const chunks = [
      { type: "start" },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "Yes, and here is why." },
      { type: "text-end", id: "t1" },
      { type: "finish" },
    ];
    const frames = await play(chunks);
    assert.deepEqual(frames, chunks, "nothing should be appended to a turn that answered");
  });

  test("a card with no prose is still something on the page", async () => {
    const chunks = [
      { type: "start" },
      { type: "tool-input-start", toolCallId: "c1", toolName: "showResume" },
      { type: "tool-output-available", toolCallId: "c1", output: { htmlHref: "/resume" } },
      { type: "finish" },
    ];
    assert.deepEqual(await play(chunks), chunks);
  });

  test("a turn that already failed is not failed twice", async () => {
    const chunks = [{ type: "start" }, { type: "error", errorText: "upstream_timeout" }, { type: "finish" }];
    assert.deepEqual(await play(chunks), chunks);
  });

  test("a stream that never finished is not called empty", async () => {
    // No `finish` means the watcher can't know the turn is over, and a body
    // that isn't a UI message stream at all never has one either. Both pass
    // through: the watcher would rather miss an empty turn than invent one.
    const chunks = [{ type: "start" }, { type: "reasoning-start", id: "r1" }];
    assert.deepEqual(await play(chunks), chunks);
  });

  test("an aborted turn gets no failure appended", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const frames = await play(REASONED_OUT, { signal: ctrl.signal });
    assert.ok(!frames.some(isEmptyAnswerChunk), "pressing stop must never render a failure");
  });
});

// The test above proves the chunk is appended. This one proves the chunk does
// what it is for, through the SDK's own chat loop — the same `AbstractChat`
// that useChat wraps, the same DefaultChatTransport the shell builds, and the
// guarded fetch between them. Before the fix this turn ended with status
// "ready" and onError never fired.
describe("the empty turn through the SDK's chat loop", () => {
  class MemoryState {
    status = "ready";
    error = undefined;
    messages = [];
    pushMessage = (m) => {
      this.messages = [...this.messages, m];
    };
    popMessage = () => {
      this.messages = this.messages.slice(0, -1);
    };
    replaceMessage = (i, m) => {
      this.messages = [...this.messages.slice(0, i), m, ...this.messages.slice(i + 1)];
    };
    snapshot = (v) => structuredClone(v);
  }

  test("the turn fails with empty_answer instead of settling on ready", async () => {
    const { AbstractChat, DefaultChatTransport } = await import("ai");
    const errors = [];
    const finished = [];
    const state = new MemoryState();
    const chat = new AbstractChat({
      state,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        fetch: guardedFetch({
          fetch: async () =>
            new Response(REASONED_OUT.map(sse).join("") + DONE, {
              status: 200,
              headers: { "content-type": "text/event-stream" },
            }),
          idleTimeoutMs: 500,
        }),
      }),
      onError: (err) => errors.push(err.message),
      onFinish: ({ isError }) => finished.push(isError),
    });

    await chat.sendMessage({ text: "Is he a fit for a RevOps role?" });

    assert.deepEqual(errors, ["empty_answer"], "onError should receive the class, once");
    assert.equal(state.status, "error");
    assert.deepEqual(finished, [true]);
  });
});
