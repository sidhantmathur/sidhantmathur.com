import {
  streamText,
  convertToModelMessages,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { buildSystemPrompt } from "@/lib/system-prompt";
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

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
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

export async function POST(req: Request): Promise<Response> {
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
    return jsonError("upstream_unavailable", 502);
  }

  try {
    const result = streamText({
      model, // allowlisted above — never the raw client string
      maxOutputTokens: 600,
      tools: chatTools,
      // The SDK's default stop condition is stepCountIs(1), which ends the
      // stream at the tool call before the model can answer. Allow a second
      // step so the model always follows a tool call with a short text answer
      // (the tool is a visual aid, not a replacement for the answer — §2.5).
      stopWhen: stepCountIs(3),
      // System prompt supplied as a message so we can attach cache_control.
      // The prompt is byte-identical across requests, so ephemeral caching hits
      // on every request after the first.
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
      // If the auth/setup fails synchronously it throws below; a mid-stream
      // failure surfaces to the client's useChat onError via the stream.
      onError: (err) => {
        console.error("[chat] stream error", err);
      },
    });

    // Surface the remaining budget so the status strip can display it. The
    // constraint is part of the interface, not something to hide.
    return result.toUIMessageStreamResponse({
      headers: {
        "x-model": model,
        "x-tier": tier,
        "x-tier-remaining": String(budget.remaining),
        "x-tier-limit": String(TIER_LIMITS[tier]),
      },
    });
  } catch (err) {
    console.error("[chat] upstream error", err);
    return jsonError("upstream_unavailable", 502);
  }
}
