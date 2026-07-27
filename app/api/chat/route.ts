import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { looksLikeJobPosting } from "@/lib/job-posting";
import {
  TURN_PART_ID,
  classifyTurnError,
  type ChatUIMessage,
  type TurnErrorClass,
  type TurnTelemetry,
} from "@/lib/chat-telemetry";
import { PROJECTS } from "@/content/projects";

// Node runtime: both @upstash/ratelimit and the in-memory fallback work fine on
// Node, and there's no edge-specific requirement here.
export const runtime = "nodejs";

// --- Request validation --------------------------------------------------
//
// useChat (@ai-sdk/react v4 / ai v7, v5-era wire format) POSTs UIMessages:
// each has an `id`, a `role`, and a `parts` array. We accept only user/assistant
// roles from the client (no `system`). The 500-char text cap applies to USER
// messages only — assistant turns are the model's own prior output (up to 600
// tokens, routinely past 500 chars) echoed back as history; capping them made
// every follow-up after one long answer fail with a 400. Assistant text gets a
// generous abuse ceiling instead. `parts` may contain non-text entries in
// principle; we validate the text ones and sum their length.

// Non-text parts are passed through untouched (schema-permissive) but only text
// parts count toward the per-role limit.
const messageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.looseObject({ type: z.string() })).min(1),
  })
  .refine(
    (msg) => {
      const textLength = msg.parts
        .filter(
          (p): p is { type: "text"; text: string } =>
            p.type === "text" && typeof p.text === "string",
        )
        .reduce((sum, p) => sum + p.text.length, 0);
      // 4000 for user turns: the JD-paste flow sends a whole job description
      // as one message, and 500 truncated every real posting. Abuse is bounded
      // by the per-tier hourly budget, not by this cap.
      return textLength <= (msg.role === "user" ? 4000 : 8000);
    },
    { message: "Message text exceeds the allowed length." },
  );

// History cap: must fit the full intended conversation — up to 10 user turns
// (enforced below with the graceful 429) plus their assistant replies — with
// headroom, so the >10-user-messages case reaches the rate-limit copy instead
// of dying on a schema 400.
// --- Model allowlist ------------------------------------------------------
//
// The client picks a model, so this is a security AND a cost boundary: the id
// from the request is never passed through to the Gateway, only used to look up
// an entry here. An unknown id falls back to the default rather than erroring,
// so a stale client can't break the chat.
//
// Each tier has its own rate-limit bucket. The point is that the budget is
// visible in the UI — showing the cost engineering rather than hiding it.
//
// COST NOTE: `standard` is cheap-tier models only. `premium` is one
// substantially more expensive model on a small bucket. Delete the premium
// entry to turn the whole tier off; nothing else needs to change.
//
// Gateway list prices per 1M tokens (in / out), checked 2026-07-27. This
// workload is input-dominated — the system prompt plus knowledge base is ~4k
// tokens on every turn against ~300 tokens of answer — so input price is what
// actually bills. Sonnet was the previous premium entry at $3/$15 and was not
// worth 3x Luna here.
const MODELS = {
  "anthropic/claude-haiku-4.5": { tier: "standard" },   // $1.00 / $5.00
  "openai/gpt-5-mini": { tier: "standard" },            // $0.25 / $2.00
  "google/gemini-3.5-flash-lite": { tier: "standard" }, // $0.30 / $2.50
  "deepseek/deepseek-v4-flash": { tier: "standard" },   // $0.09 / $0.18
  "openai/gpt-5.6-luna": { tier: "premium" },           // $1.00 / $6.00
} as const;

type ModelId = keyof typeof MODELS;
type Tier = (typeof MODELS)[ModelId]["tier"];

const DEFAULT_MODEL: ModelId = "anthropic/claude-haiku-4.5";

const TIER_LIMITS: Record<Tier, number> = {
  standard: 20,
  premium: 5,
};

function resolveModel(requested: string | undefined): ModelId {
  return requested && requested in MODELS ? (requested as ModelId) : DEFAULT_MODEL;
}

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
  // Free-form string, validated by lookup rather than by enum, so adding a
  // model here never requires a client deploy to avoid 400s.
  model: z.string().max(100).optional(),
});

// --- Rate limiting -------------------------------------------------------
//
// Per-IP, 20 messages/hour, sliding window. Upstash-backed when the env vars are
// present; otherwise an in-memory Map fallback so `npm run dev` and the local
// build run with zero external services.
//
// NOTE: the in-memory fallback is PER-INSTANCE and NOT shared across serverless
// instances. It exists only so the site runs locally with an empty .env.local.
// Real production rate limiting requires UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN to be set (README morning-checklist step 5).

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

// One limiter per tier, so spending the premium budget leaves the standard
// budget intact.
const upstashLimiters = hasUpstash
  ? (Object.fromEntries(
      (Object.keys(TIER_LIMITS) as Tier[]).map((tier) => [
        tier,
        new Ratelimit({
          redis: Redis.fromEnv(),
          limiter: Ratelimit.slidingWindow(TIER_LIMITS[tier], "1 h"),
          prefix: `chat:${tier}`,
        }),
      ]),
    ) as Record<Tier, Ratelimit>)
  : null;

// Module-scope in-memory store for the fallback (per-instance, dev-only).
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function inMemoryConsume(key: string, limit: number): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { ok: false, remaining: 0 };
  entry.count += 1;
  return { ok: true, remaining: Math.max(0, limit - entry.count) };
}

async function consumeBudget(
  ip: string,
  tier: Tier,
): Promise<{ ok: boolean; remaining: number }> {
  const limit = TIER_LIMITS[tier];
  if (upstashLimiters) {
    const { success, remaining } = await upstashLimiters[tier].limit(ip);
    return { ok: success, remaining: Math.max(0, remaining) };
  }
  return inMemoryConsume(`${tier}:${ip}`, limit);
}

function getClientIp(req: Request): string {
  // Vercel sets x-forwarded-for; take the first entry (the original client).
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Every early exit carries a telemetry error class as its body, so the client
// reads one vocabulary whether a turn died before the model or during it.
function jsonError(error: TurnErrorClass, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// --- Per-turn output ceiling ---------------------------------------------
//
// 600 tokens is right for a conversational answer. A job-posting turn has to
// fit a whole `roleFit` object AND the sentence that follows it, and a turn
// truncated mid-tool-call loses the tool call entirely — the exact failure this
// sprint is fixing, arriving by a different road.
//
// The JD ceiling is 2500 and not 1000 because of a measured failure, not a
// guess: at 1000, `openai/gpt-5-mini` finished three of five postings with
// `finishReason: "length"` and NOTHING to show — a reasoning model spends the
// per-step budget on reasoning tokens before it ever emits the tool call. On a
// forced-tool turn that reads exactly like the abandonment bug being fixed
// here, which is why the eval runner now prints the finish reason. Non-
// reasoning models are unaffected: this is a ceiling, not a target, and they
// still answer in ~400.
const MAX_OUTPUT_TOKENS = 600;
const MAX_OUTPUT_TOKENS_JD = 2500;

/** The last user turn's text, which is what the JD detector reads. */
function lastUserText(messages: z.infer<typeof bodySchema>["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]!;
    if (msg.role !== "user") continue;
    return msg.parts
      .filter(
        (p): p is { type: "text"; text: string } =>
          p.type === "text" && typeof p.text === "string",
      )
      .map((p) => p.text)
      .join("\n");
  }
  return "";
}

// --- Chat tools ----------------------------------------------------------
//
// Four tools the model can call to render visual UI in the chat (Phase 4,
// 04 §2). NOTE: `ai@7` uses the v5-era `tool()` API — schemas go under
// `inputSchema` (NOT `parameters`). Each `execute` does no I/O beyond reading
// static, build-time-bundled copy — no new fetches, no new dependencies.
//
// Client renders these as typed `tool-<name>` message parts (see
// app/chat/page.tsx), switching on `part.state === 'output-available'`.

const chatTools = {
  // 2.1 — visual card for one of the three projects. The model only picks the
  // slug; all card content comes from the shared content/projects.ts module
  // (no model generation of card copy).
  showProject: tool({
    description: "Show a visual card for one of Sidhant's three projects.",
    inputSchema: z.object({
      slug: z.enum(["adarle20", "nokia", "dell-ml"]),
    }),
    execute: async ({ slug }) => {
      const p = PROJECTS[slug];
      return {
        slug: p.slug,
        index: p.index,
        title: p.title,
        description: p.description,
        role: p.role,
        stack: p.stack,
        status: p.status,
        caseStudyHref: p.caseStudyHref,
        image: p.image ?? null,
      };
    },
  }),

  // 2.2 — resume card. Zero-arg tool; returns a fixed object. pdfAvailable is
  // true — resume.pdf ships in public/.
  showResume: tool({
    description: "Show a card to download or view the resume.",
    inputSchema: z.object({}),
    execute: async () => ({
      htmlHref: "/resume",
      pdfHref: "/resume.pdf",
      pdfAvailable: true,
    }),
  }),

  // 2.3 — structured skills-match breakdown. The CONTENT (areas, evidence) is
  // model-generated and grounded via the system prompt (§2.5); execute only
  // does light validation: trims strings, caps matches at 5, and passes the
  // shape through to the client.
  roleFit: tool({
    description:
      "Show a structured skills-match breakdown mapping Sidhant's experience to a named role the user is asking about (e.g. GTM engineer, solutions engineer, RevOps, sales ops). Only call this after you've formed a grounded answer — every 'evidence' string must restate a fact that exists in the knowledge base, not a generalization.",
    inputSchema: z.object({
      role: z
        .string()
        .describe(
          "The role name as the user phrased it or a close normalization, e.g. 'GTM engineer', 'solutions engineer', 'RevOps', 'sales ops'.",
        ),
      matches: z
        .array(
          z.object({
            area: z
              .string()
              .describe(
                "A short skill/competency label relevant to the role, e.g. 'Cross-functional ownership', 'SQL and data modeling'.",
              ),
            evidence: z
              .string()
              .describe(
                "One sentence of grounded evidence from the knowledge base — a specific project, number, or outcome. No invented specifics.",
              ),
          }),
        )
        .min(2)
        .max(5),
      caveats: z
        .string()
        .optional()
        .describe(
          "Optional one-sentence honest gap or stretch for this role, if one exists. Omit if there is nothing honest to say.",
        ),
    }),
    execute: async ({ role, matches, caveats }) => ({
      role: role.trim(),
      matches: matches.slice(0, 5).map((m) => ({
        area: m.area.trim(),
        evidence: m.evidence.trim(),
      })),
      ...(caveats && caveats.trim()
        ? { caveats: caveats.trim() }
        : {}),
    }),
  }),

  // 2.4 — contact card. Zero-arg tool; returns the fixed footer links. Salary
  // and address stay private; the phone number now appears on /resume, but
  // this card keeps contact routed through email and social.
  contactCard: tool({
    description: "Show a card with ways to contact Sidhant.",
    inputSchema: z.object({}),
    execute: async () => ({
      email: "mailto:hello@sidhantmathur.com",
      github: "https://github.com/sidhantmathur",
      linkedin: "https://www.linkedin.com/in/sidhantmathur",
    }),
  }),
};

// --- Failure theatre (roadmap Sprint 2, #6) ------------------------------
//
// The careful degradation in this route — 400 for a bad body, 429 for the
// conversation cap and again for the hourly budget, 502 for a missing key, and
// a mid-stream failure that arrives as an error chunk on an HTTP 200 — is the
// most reliable signal of production experience on the site and the least
// visible, because it only shows up when something breaks.
//
// `?simulate=<class>` makes each path reproducible on demand. Three rules, and
// they're the reason this is safe to leave on in production:
//
//   1. It NEVER calls the model and never consumes the visitor's budget. A
//      simulated failure costs zero tokens and zero turns.
//   2. It is not a bypass. It can only produce failures, never an answer, and
//      the class is looked up in a closed list — an unrecognised value is
//      ignored and the request proceeds as a normal turn.
//   3. It takes the SAME exits as the real thing: `jsonError` for the early
//      classes, and for the mid-stream ones an actual throw inside
//      `createUIMessageStream`, so the response is genuinely an HTTP 200 whose
//      stream carries an error chunk. Faking the shape would defeat the point.

/** The early exits: a status code and a JSON body, before a stream exists. */
const SIMULATED_STATUS: Partial<Record<TurnErrorClass, number>> = {
  invalid_request: 400,
  rate_limited: 429,
  upstream_unconfigured: 502,
};

const SIMULATABLE: TurnErrorClass[] = [
  "invalid_request",
  "rate_limited",
  "upstream_unconfigured",
  "upstream_auth",
  "upstream_timeout",
  "upstream_unavailable",
  "aborted",
  "unknown",
];

function simulatedClass(req: Request): TurnErrorClass | null {
  const value = new URL(req.url).searchParams.get("simulate");
  const match = SIMULATABLE.find((c) => c === value);
  return match ?? null;
}

/**
 * The mid-stream half: HTTP 200, a real stream, a real throw. `createUIMessageStream`'s
 * `onError` classifies it exactly as it would a Gateway failure, so the client
 * receives the same error chunk and the same closing telemetry record.
 */
function simulateStreamFailure(cls: TurnErrorClass, model: ModelId): Response {
  const startedAt = Date.now();
  const telemetry: TurnTelemetry = {
    model,
    tier: MODELS[model].tier,
    budgetRemaining: TIER_LIMITS[MODELS[model].tier],
    budgetLimit: TIER_LIMITS[MODELS[model].tier],
    jobPosting: false,
    usage: null,
    timing: null,
    steps: null,
    toolsCalled: null,
    finishReason: null,
    error: null,
  };

  const stream = createUIMessageStream<ChatUIMessage>({
    // Returned verbatim rather than run through `classifyTurnError`. The
    // classifier's job is to map an unknown upstream error onto the vocabulary;
    // here the class is the input, and round-tripping it through pattern
    // matching would only introduce a way for the demo to show the wrong one.
    // What's being exercised is the TRANSPORT — an HTTP 200 whose stream ends
    // in an error chunk — and that is real.
    onError: () => cls,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-turn", id: TURN_PART_ID, data: telemetry });
      telemetry.error = { class: cls, detail: "simulated" };
      telemetry.timing = { ttftMs: null, durationMs: Date.now() - startedAt, tokensPerSecond: null };
      writer.write({ type: "data-turn", id: TURN_PART_ID, data: telemetry });
      writer.write({ type: "finish" });
      // Thrown last so the record above has already reached the client, which
      // is the ordering a real mid-stream failure produces too.
      throw new Error(`simulated ${cls}`);
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "x-model": model, "x-simulated": cls },
  });
}

export async function POST(req: Request): Promise<Response> {
  // (0) Failure theatre, ahead of everything: no body parsing, no budget, no
  // model. See the block comment above.
  const simulate = simulatedClass(req);
  if (simulate) {
    const status = SIMULATED_STATUS[simulate];
    if (status) return jsonError(simulate, status);
    return simulateStreamFailure(simulate, DEFAULT_MODEL);
  }

  // (a) Parse and validate the body.
  let parsed: z.infer<typeof bodySchema>;
  try {
    const body = await req.json();
    parsed = bodySchema.parse(body);
  } catch {
    // Malformed request — generic 400, NOT the rate-limit copy.
    return jsonError("invalid_request", 400);
  }

  const { messages } = parsed;
  const model = resolveModel(parsed.model);
  const tier = MODELS[model].tier;

  // (b) Conversation cap: more than 10 user messages → rate-limit state.
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  if (userMessageCount > 10) {
    return jsonError("rate_limited", 429);
  }

  // (c) Per-IP, per-tier sliding-window budget.
  const ip = getClientIp(req);
  const budget = await consumeBudget(ip, tier);
  if (!budget.ok) {
    return jsonError("rate_limited", 429);
  }

  // (d) Stream the model response through the Vercel AI Gateway.
  //
  // Missing AI_GATEWAY_API_KEY (or any upstream failure) is returned as a
  // structured 502 — never a raw stack trace / 500. Distinct status/body from
  // the 429 above so the client can tell "capped" from "broken".
  //
  // The Gateway's auth failure surfaces lazily (mid-stream) rather than at the
  // streamText() call, so we check the key up front to guarantee a real 502
  // response for the missing-key case instead of a 200 with an error buried in
  // the stream. This is also the graceful-degradation path for an empty
  // .env.local: the /chat UI maps this 502 to the copy's error state.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return jsonError("upstream_unconfigured", 502);
  }

  // (e) Is this a pasted job description? Decided once, up front, because it
  // changes both the output ceiling and whether `roleFit` is optional.
  const jobPosting = looksLikeJobPosting(lastUserText(messages));

  const startedAt = Date.now();

  // The record the client reads. Written twice under one part id: everything
  // known now, then the measurements once the model is done. See
  // lib/chat-telemetry.ts for why it's a data part and not a header.
  const telemetry: TurnTelemetry = {
    model,
    tier,
    budgetRemaining: budget.remaining,
    budgetLimit: TIER_LIMITS[tier],
    jobPosting,
    usage: null,
    timing: null,
    steps: null,
    toolsCalled: null,
    finishReason: null,
    error: null,
  };

  const stream = createUIMessageStream<ChatUIMessage>({
    // The default masks every error as "An error occurred." The class is safe
    // to expose — it's a closed vocabulary with no server detail in it — and
    // the client needs it to tell "capped" from "broken" from "misconfigured".
    onError: (err) => {
      console.error("[chat] stream error", err);
      return classifyTurnError(err);
    },
    execute: async ({ writer }) => {
      // `start` and `finish` are written here rather than by the merged stream
      // (hence sendStart/sendFinish below), so the final telemetry write lands
      // inside the message rather than after it has already been closed.
      writer.write({ type: "start" });
      writer.write({ type: "data-turn", id: TURN_PART_ID, data: telemetry });

      const result = streamText({
        model, // allowlisted above — never the raw client string
        maxOutputTokens: jobPosting ? MAX_OUTPUT_TOKENS_JD : MAX_OUTPUT_TOKENS,
        tools: chatTools,
        // The SDK's default stop condition is stepCountIs(1), which ends the
        // stream at the tool call before the model can answer. Allow a second
        // step so the model always follows a tool call with a short text answer
        // (the tool is a visual aid, not a replacement for the answer — §2.5).
        stopWhen: stepCountIs(3),
        // THE JD FIX. On a job-posting turn the structured assessment is the
        // feature, so it is not left to the model's discretion: step 0 must
        // call `roleFit`. Steps after it get `toolChoice: "none"` — without
        // that, a forced choice applies to every step and the model calls the
        // tool again instead of writing the sentence that follows it.
        //
        // Non-JD turns are untouched: `undefined` means "use the outer
        // setting", which is the default `auto`.
        prepareStep: jobPosting
          ? ({ stepNumber }) =>
              stepNumber === 0
                ? { toolChoice: { type: "tool", toolName: "roleFit" } }
                : { toolChoice: "none" }
          : undefined,
        // System prompt supplied as a message so we can attach cache_control.
        // The prompt is byte-identical across requests, so ephemeral caching
        // hits on every request after the first.
        allowSystemInMessages: true,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(),
            providerOptions: {
              anthropic: { cacheControl: { type: "ephemeral" } },
            },
          },
          ...(await convertToModelMessages(messages as Omit<UIMessage, "id">[])),
        ],
      });

      writer.merge(result.toUIMessageStream({ sendStart: false, sendFinish: false }));

      try {
        const [steps, usage, finishReason] = await Promise.all([
          result.steps,
          result.totalUsage,
          result.finishReason,
        ]);

        // TTFT is the first step's — the wait a reader actually experiences.
        // Tokens/sec is measured over generation time only, so the queueing and
        // tool-execution gaps between steps don't deflate it.
        const generationMs = steps.reduce((ms, s) => ms + (s.performance?.stepTimeMs ?? 0), 0);
        const outputTokens = usage.outputTokens ?? null;

        telemetry.usage = {
          inputTokens: usage.inputTokens ?? null,
          cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? null,
          cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? null,
          outputTokens,
          totalTokens: usage.totalTokens ?? null,
        };
        // Rounded: the SDK reports fractional milliseconds, and sub-millisecond
        // precision on a network measurement is noise that reads as false
        // exactness once it's on screen next to a dollar figure.
        const ttftMs = steps[0]?.performance?.timeToFirstOutputMs;
        telemetry.timing = {
          ttftMs: ttftMs != null ? Math.round(ttftMs) : null,
          durationMs: Date.now() - startedAt,
          tokensPerSecond:
            outputTokens && generationMs > 0
              ? Math.round((outputTokens / (generationMs / 1000)) * 10) / 10
              : null,
        };
        telemetry.steps = steps.length;
        telemetry.toolsCalled = steps.flatMap((s) => s.toolCalls.map((c) => c.toolName));
        telemetry.finishReason = finishReason;
      } catch (err) {
        // The merged stream has already surfaced the failure to the reader.
        // What's added here is the CLASS, so #6 can render the difference
        // between a timeout and a misconfiguration instead of one grey box.
        console.error("[chat] turn failed", err);
        telemetry.error = {
          class: classifyTurnError(err),
          detail: err instanceof Error ? err.name : "error",
        };
        telemetry.timing = {
          ttftMs: null,
          durationMs: Date.now() - startedAt,
          tokensPerSecond: null,
        };
      }

      writer.write({ type: "data-turn", id: TURN_PART_ID, data: telemetry });
      writer.write({ type: "finish" });
    },
  });

  // Headers stay: they're the pre-stream budget signal the status strip reads
  // before a single token arrives, and the live eval harness reads them too.
  return createUIMessageStreamResponse({
    stream,
    headers: {
      "x-model": model,
      "x-tier": tier,
      "x-tier-remaining": String(budget.remaining),
      "x-tier-limit": String(TIER_LIMITS[tier]),
    },
  });
}
