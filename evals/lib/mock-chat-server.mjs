// A stand-in for /api/chat that replays one recorded fit check
// (evals/fixtures/recorded-fit-check.json) in the route's own stream format,
// so the stability harness can run end to end with no API key and no spend.
//
// It is NOT a model and its numbers are not measurements. It exists to
// exercise the harness: the SSE framing, the tool events, the closing
// telemetry record, the early-exit JSON errors, the per-IP hourly budget, and
// enough seeded variation between repeats (a verdict that moves, a
// requirement dropped or trimmed) that the agreement arithmetic has something
// to find.
//
// In-process, for tests (no socket):
//   const mock = createMockChat({ mode: "replay" });
//   await runTurn({ base: "http://mock", body, fetchImpl: mock.fetch });
//
// On a port, for a whole run:
//   node --experimental-strip-types evals/lib/mock-chat-server.mjs --port 3102 --mode mixed --speed 0.05
//
// Modes: replay (default), mixed (mostly replay, some blank turns and stream
// errors), no-key (502, as the route answers without AI_GATEWAY_API_KEY),
// rate-limit (429), blank, stream-error.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_MODEL, HOURLY_LIMIT, MODELS } from "../../lib/models.ts";
import { MAX_USER_TEXT, looksLikeJobPosting } from "../../lib/job-posting.ts";
import { reconcileRoleFit } from "../../lib/role-fit.ts";
import { readChunks } from "./artifacts.mjs";
import { hash32 } from "./postings.mjs";

// The record chunks, as the route's CHUNK_BY_ID: the varied rows go through
// the real reconciler, so a verdict the variation raised without a source is
// downgraded exactly as the route would. Null when the corpus isn't built.
const RECORD_CHUNKS = (() => {
  try {
    return Object.fromEntries(readChunks().map((c) => [c.id, c]));
  } catch {
    return null;
  }
})();

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(join(HERE, "..", "fixtures", "recorded-fit-check.json"), "utf8"));

const recorded = (() => {
  const parts = FIXTURE.messages.find((m) => m.role === "assistant").parts;
  return {
    extraction: parts.find((p) => p.type === "tool-extractRequirements").output,
    card: parts.find((p) => p.type === "tool-roleFit").output,
    answer: parts.filter((p) => p.type === "text").map((p) => p.text).join(""),
  };
})();

/** mulberry32: a small seeded generator, so a run's variation is reproducible. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NEIGHBOUR = { met: ["partial"], partial: ["met", "unmet"], unmet: ["partial"], unclear: ["unmet"] };
// A posting nothing in the record covers. The mock leans these toward unmet so
// the harness's negative-control check has a path to exercise.
const MISMATCH_SHAPE = /\b(?:machine learning|gpu|cuda|kubernetes|distributed systems|account executive|quota|engineering manager|direct reports|staff software engineer)\b/i;

/** One varied copy of the recorded card. */
function variedTurn(postingText, n, vary) {
  const rand = rng(hash32(postingText) ^ Math.imul(n + 1, 0x9e3779b1));
  let requirements = [...recorded.extraction.requirements];
  // The rows as the model claimed them, before the route's reconciler ran.
  let rows = recorded.card.rows.map((r) => ({ ...r, verdict: r.claimedVerdict ?? r.verdict }));

  if (rand() < 0.2 && requirements.length > 1) {
    const dropped = requirements.pop();
    rows = rows.filter((r) => r.requirement !== dropped);
  }
  if (rand() < 0.2) {
    const i = Math.floor(rand() * rows.length);
    const short = rows[i].requirement.split(/(?<=[.:;])\s/)[0];
    requirements = requirements.map((q) => (q === rows[i].requirement ? short : q));
    rows[i].requirement = short;
  }
  const mismatch = MISMATCH_SHAPE.test(postingText);
  for (const r of rows) {
    if (mismatch && r.verdict !== "unmet" && rand() < 0.8) {
      r.verdict = "unmet";
      r.sources = [];
      continue;
    }
    if (rand() < vary) r.verdict = NEIGHBOUR[r.verdict][Math.floor(rand() * NEIGHBOUR[r.verdict].length)];
  }
  // What the model "sent": the recorded rows at their claimed verdicts.
  const raw = {
    role: recorded.card.role,
    rows: rows.map((r) => ({ requirement: r.requirement, verdict: r.verdict, evidence: r.evidence, sources: r.sources })),
    verdict: recorded.card.verdict,
  };
  let card;
  if (RECORD_CHUNKS) {
    card = reconcileRoleFit(raw, requirements, RECORD_CHUNKS);
  } else {
    const counts = { met: 0, partial: 0, unmet: 0, unclear: 0 };
    for (const r of rows) counts[r.verdict] += 1;
    card = { ...recorded.card, rows, counts, gaps: rows.filter((r) => r.verdict === "unmet").map((r) => r.requirement) };
  }
  return { extraction: { role: recorded.extraction.role, requirements }, card, answer: recorded.answer };
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function chunked(text, size) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/**
 * The mock: `handle(Request) → Response`, plus `fetch` for runTurn's
 * fetchImpl, and the counters a test can assert on.
 */
export function createMockChat({ mode = "replay", vary = 0.15, speed = 0, now = () => Date.now() } = {}) {
  const buckets = new Map();
  const perPosting = new Map();
  const stats = { requests: 0, streamed: 0, byStatus: {} };
  const sleep = (ms) => (speed > 0 ? new Promise((r) => setTimeout(r, ms * speed)) : Promise.resolve());

  function consume(ip) {
    const t = now();
    const b = buckets.get(ip);
    if (!b || t > b.resetAt) {
      buckets.set(ip, { count: 1, resetAt: t + 3_600_000 });
      return { ok: true, remaining: HOURLY_LIMIT - 1 };
    }
    if (b.count >= HOURLY_LIMIT) return { ok: false, remaining: 0 };
    b.count += 1;
    return { ok: true, remaining: HOURLY_LIMIT - b.count };
  }

  async function handle(request) {
    stats.requests += 1;
    const respond = (res) => {
      stats.byStatus[res.status] = (stats.byStatus[res.status] ?? 0) + 1;
      return res;
    };
    let body;
    try {
      body = await request.json();
    } catch {
      return respond(json(400, { error: "invalid_request" }));
    }
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const last = messages.at(-1);
    const text = (last?.parts ?? []).filter((p) => p?.type === "text").map((p) => p.text).join("\n");
    if (!messages.length || last?.role !== "user" || text.length > MAX_USER_TEXT) {
      return respond(json(400, { error: "invalid_request" }));
    }
    const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    const budget = consume(ip);
    if (mode === "rate-limit" || !budget.ok) return respond(json(429, { error: "rate_limited" }));
    if (mode === "no-key") return respond(json(502, { error: "upstream_unconfigured" }));

    const model = typeof body.model === "string" && body.model in MODELS ? body.model : DEFAULT_MODEL;
    const posting = looksLikeJobPosting(text);
    const key = `${model}|${hash32(text)}`;
    const n = perPosting.get(key) ?? 0;
    perPosting.set(key, n + 1);

    let shape = mode;
    if (mode === "mixed") {
      const roll = rng(hash32(key) ^ (n * 7919))();
      shape = roll < 0.06 ? "blank" : roll < 0.1 ? "stream-error" : "replay";
    }
    const turn = variedTurn(text, n, vary);
    stats.streamed += 1;

    const encoder = new TextEncoder();
    const started = now();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        const telemetry = {
          model,
          budgetRemaining: budget.remaining,
          budgetLimit: HOURLY_LIMIT,
          jobPosting: posting,
          siteQuestion: false,
          usage: null,
          timing: null,
          steps: null,
          toolsCalled: null,
          finishReason: null,
          error: null,
        };
        send({ type: "start" });
        send({ type: "data-turn", id: "turn", data: { ...telemetry } });
        const close = (extra) => {
          Object.assign(telemetry, extra, { timing: { ttftMs: 900, durationMs: now() - started, tokensPerSecond: 140 } });
          send({ type: "data-turn", id: "turn", data: { ...telemetry } });
          send({ type: "finish" });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        };

        if (shape === "blank") {
          send({ type: "start-step" });
          send({ type: "reasoning-start", id: "r0" });
          await sleep(6000);
          send({ type: "reasoning-end", id: "r0" });
          send({ type: "finish-step" });
          const usage = { inputTokens: 7800, cachedInputTokens: 7100, cacheWriteTokens: 0, outputTokens: 4000, reasoningTokens: 4000, totalTokens: 11800 };
          return close({ usage, steps: 1, toolsCalled: [], finishReason: "length", error: { class: "empty_answer", detail: "length" } });
        }

        // Step 0: the extraction.
        send({ type: "start-step" });
        await sleep(900);
        const ex = `call_ex_${n}`;
        send({ type: "tool-input-start", toolCallId: ex, toolName: "extractRequirements" });
        for (const part of chunked(JSON.stringify(turn.extraction), 160)) {
          await sleep(120);
          send({ type: "tool-input-delta", toolCallId: ex, inputTextDelta: part });
        }
        send({ type: "tool-input-available", toolCallId: ex, toolName: "extractRequirements", input: turn.extraction });
        send({ type: "tool-output-available", toolCallId: ex, output: turn.extraction });
        send({ type: "finish-step" });

        if (shape === "stream-error") {
          send({ type: "error", errorText: "upstream_timeout" });
          return close({ error: { class: "upstream_timeout", detail: "Error" } });
        }

        // Step 1: the assessment.
        send({ type: "start-step" });
        send({ type: "reasoning-start", id: "r1" });
        await sleep(1500);
        send({ type: "reasoning-end", id: "r1" });
        const rf = `call_rf_${n}`;
        send({ type: "tool-input-start", toolCallId: rf, toolName: "roleFit" });
        for (const part of chunked(JSON.stringify({ role: turn.card.role, rows: turn.card.rows }), 220)) {
          await sleep(250);
          send({ type: "tool-input-delta", toolCallId: rf, inputTextDelta: part });
        }
        send({ type: "tool-input-available", toolCallId: rf, toolName: "roleFit", input: { role: turn.card.role } });
        send({ type: "tool-output-available", toolCallId: rf, output: turn.card });
        send({ type: "finish-step" });

        // Step 2: the sentence after.
        send({ type: "start-step" });
        send({ type: "text-start", id: "t2" });
        for (const part of chunked(turn.answer, 40)) {
          await sleep(60);
          send({ type: "text-delta", id: "t2", delta: part });
        }
        send({ type: "text-end", id: "t2" });
        send({ type: "finish-step" });

        const inputTokens = 19_000 + Math.round(text.length / 3.4) * 3;
        const outputTokens = 1_400 + 40 * turn.card.rows.length;
        const usage = { inputTokens, cachedInputTokens: 15_000, cacheWriteTokens: 0, outputTokens, reasoningTokens: 0, totalTokens: inputTokens + outputTokens };
        close({ usage, steps: 3, toolsCalled: ["extractRequirements", "roleFit"], finishReason: "stop" });
      },
    });
    return respond(
      new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
          "x-model": model,
          "x-budget-remaining": String(budget.remaining),
          "x-budget-limit": String(HOURLY_LIMIT),
          "x-mock-chat": shape,
        },
      }),
    );
  }

  return {
    handle,
    fetch: (url, init) => handle(new Request(url, init)),
    stats,
  };
}

// --- On a port ----------------------------------------------------------------

export function serveMockChat({ port, ...options }) {
  const mock = createMockChat(options);
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || !req.url.startsWith("/api/chat")) {
      res.writeHead(404).end();
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(`http://localhost${req.url}`, {
      method: "POST",
      headers: req.headers,
      body: Buffer.concat(chunks),
    });
    const response = await mock.handle(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) return res.end();
    for await (const chunk of response.body) res.write(chunk);
    res.end();
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, mock })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  const port = Number(flag("port", "3102"));
  const mode = flag("mode", "replay");
  const { mock } = await serveMockChat({ port, mode, vary: Number(flag("vary", "0.15")), speed: Number(flag("speed", "0.05")) });
  console.log(`Mock /api/chat on http://127.0.0.1:${port} (mode ${mode}). Not a model; nothing it returns is a measurement.`);
  process.on("SIGINT", () => {
    console.log(`\nMock served ${mock.stats.requests} request(s): ${JSON.stringify(mock.stats.byStatus)}`);
    process.exit(0);
  });
}
