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
// roles from the client (no `system`), cap history at 12 messages, and cap each
// message's total text at 500 chars. `parts` may contain non-text entries in
// principle; we validate the text ones and sum their length.

// Non-text parts are passed through untouched (schema-permissive) but only text
// parts count toward the 500-char limit.
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
      return textLength <= 500;
    },
    { message: "Message text must be 500 characters or fewer." },
  );

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(12),
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

const RATE_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashLimiter = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(RATE_LIMIT, "1 h"),
      prefix: "chat",
    })
  : null;

// Module-scope in-memory store for the fallback (per-instance, dev-only).
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function inMemoryAllow(ip: string): boolean {
  const now = Date.now();
  const entry = memoryStore.get(ip);
  if (!entry || now > entry.resetAt) {
    memoryStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

async function isRateLimited(ip: string): Promise<boolean> {
  if (upstashLimiter) {
    const { success } = await upstashLimiter.limit(ip);
    return !success;
  }
  return !inMemoryAllow(ip);
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
  // hardcoded false for the overnight build (resume.pdf is a morning task).
  showResume: tool({
    description: "Show a card to download or view the resume.",
    inputSchema: z.object({}),
    execute: async () => ({
      htmlHref: "/resume",
      pdfHref: "/resume.pdf",
      pdfAvailable: false,
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

  // 2.4 — contact card. Zero-arg tool; returns the fixed footer links. Never
  // exposes salary/address/phone (the phone number is deliberately excluded
  // from every published surface — 00-decisions.md §11).
  contactCard: tool({
    description: "Show a card with ways to contact Sidhant.",
    inputSchema: z.object({}),
    execute: async () => ({
      email: "mailto:sidhant185@gmail.com",
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

  // (b) Conversation cap: more than 10 user messages → rate-limit state.
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  if (userMessageCount > 10) {
    return jsonError("rate_limited", 429);
  }

  // (c) Per-IP sliding-window rate limit.
  const ip = getClientIp(req);
  if (await isRateLimited(ip)) {
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
      model: "anthropic/claude-haiku-4.5", // Vercel AI Gateway — no provider SDK, no API key in code.
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

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("[chat] upstream error", err);
    return jsonError("upstream_unavailable", 502);
  }
}
