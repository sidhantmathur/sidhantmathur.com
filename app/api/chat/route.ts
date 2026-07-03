import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { buildSystemPrompt } from "@/lib/system-prompt";

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
