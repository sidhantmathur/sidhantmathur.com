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

  test("a complete tier triple fires onBudget with parsed numbers", async () => {
    const seen = [];
    const gf = guardedFetch({
      fetch: async () =>
        withHeaders({ "x-tier": "flagship", "x-tier-remaining": "3", "x-tier-limit": "10" }),
      onBudget: (b) => seen.push(b),
      idleTimeoutMs: 500,
    });

    await gf("/api/chat");
    assert.deepEqual(seen, [{ tier: "flagship", remaining: 3, limit: 10 }]);
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
        withHeaders({ "x-tier": "flagship", "x-tier-remaining": "lots", "x-tier-limit": "10" }),
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
