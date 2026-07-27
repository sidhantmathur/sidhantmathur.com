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
import { looksLikeJobPosting, wrapPosting } from "@/lib/job-posting";
import { reconcileRoleFit } from "@/lib/role-fit";
import { CHUNK_BY_ID } from "@/lib/chunks.generated";
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

/**
 * Rewrites the last user message so the posting arrives fenced and re-asserted.
 *
 * Only that message, and only its text: the earlier turns are history the model
 * has already answered, and re-fencing them every turn would change the prefix
 * of the conversation on each request for no benefit.
 */
function hardenPosting(messages: z.infer<typeof bodySchema>["messages"]) {
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]!.role === "user") {
      lastUserIndex = i;
      break;
    }
  }
  return (msg: (typeof messages)[number], index: number) => {
    if (index !== lastUserIndex) return msg;
    const nonText = msg.parts.filter((p) => p.type !== "text");
    const text = msg.parts
      .filter(
        (p): p is { type: "text"; text: string } =>
          p.type === "text" && typeof p.text === "string",
      )
      .map((p) => p.text)
      .join("\n");
    return { ...msg, parts: [...nonText, { type: "text", text: wrapPosting(text) }] };
  };
}

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
// Tools the model can call to render visual UI in the chat (Phase 4, 04 §2).
// NOTE: `ai@7` uses the v5-era `tool()` API — schemas go under `inputSchema`
// (NOT `parameters`). Each `execute` does no I/O beyond reading static,
// build-time-bundled copy — no new fetches, no new dependencies.
//
// Client renders these as typed `tool-<name>` message parts, switching on
// `part.state === 'output-available'`.
//
// SPRINT 4 — the job-description flow is now TWO calls, not one:
//
//   extractRequirements  the posting's requirements, verbatim, before anything
//                        has an opinion about them
//   roleFit              a verdict per requirement, each positive one citing a
//                        chunk id, plus the gaps
//
// Splitting them is bank §6 Stage 1's fourth change and the only place on this
// site where a multi-step loop earns its keep: asked to extract and judge at
// once, a model compresses toward a flattering summary and quietly drops the
// requirements it would have to say no to. Extracting first fixes the list
// before the judging starts, and `lib/role-fit.ts` then holds the judgment to
// it — every extracted requirement gets a row, whether the model wrote one or
// not.

/**
 * One assessed requirement, as loosely as it can be stated and still be useful.
 *
 * A bare string is accepted because that is the shape a model falls into when
 * it echoes the extraction step instead of judging it, and a rejected tool call
 * costs the whole assessment (Sprint 1's lesson, met again on this sprint's
 * first live run). `lib/role-fit.ts` normalizes whatever arrives and marks what
 * doesn't hold up.
 */
const rowSchema = z.array(
  z.union([
    z.object({
      requirement: z
        .string()
        .describe(
          "The requirement in the POSTING's words, copied from the extraction step. When no posting was pasted, a requirement the named role genuinely implies.",
        ),
      verdict: z
        .string()
        .describe(
          "Exactly one of: met, partial, unmet, unclear. met — the record shows this. partial — some of it, honestly short of the ask. unmet — the record does not show it. unclear — the knowledge base doesn't cover it either way, which is NOT a gentler word for unmet.",
        ),
      evidence: z
        .string()
        .describe(
          "One sentence. For met/partial, the specific fact from the knowledge base that supports it — a project, a number, a named tool. For unmet/unclear, what is missing, in a sentence that does not dissolve it.",
        ),
      sources: z
        .array(z.string())
        .describe(
          "Chunk ids backing this row, e.g. ['resume:nokia']. Required for met and partial — a row that claims a fit and cites nothing is downgraded to unclear by the site, not by you. Leave empty for unmet and unclear: an absence has nothing to cite.",
        ),
    }),
    z.string(),
  ]),
);

// Built per request rather than at module scope (Sprint 4): the two halves of a
// job-description turn are separate tool calls, and the judging half has to see
// what the extracting half produced. `extraction` is that hand-off — one
// request's requirement list, closed over by both tools, never shared between
// requests.
function buildChatTools(extraction: { requirements: string[] }) {
  return {
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

    // 2.3a — extraction. No judgment, no evidence, no verdicts: this call only
    // copies out what the posting asks for. Its output is not rendered; it is
    // the input to the next call and to the coverage check after it.
    extractRequirements: tool({
      description:
        "Read a pasted job posting and list the requirements it states, verbatim. Extraction only — do not assess anything here, do not skip a requirement because Sidhant does not meet it, and do not merge two requirements into one line.",
      inputSchema: z.object({
        role: z
          .string()
          .describe("The role title as the posting states it."),
        requirements: z
          .array(
            z
              .string()
              .describe(
                "One requirement, in the posting's own words. Trim the bullet, keep the wording.",
              ),
          )
          .describe(
            "Every requirement, qualification, or responsibility the posting states — including the ones Sidhant clearly does not meet. This list is what the assessment is scored against, so an omission here is an omission there.",
          ),
      }),
      execute: async ({ role, requirements }) => {
        // Deduplicated and capped, because the next call has to answer every
        // line of this list and the table has to stay readable.
        const seen = new Set<string>();
        const cleaned: string[] = [];
        for (const raw of requirements) {
          const text = raw.trim().replace(/^[-•*]\s*/, "").slice(0, 240);
          const key = text.toLowerCase();
          if (!text || seen.has(key)) continue;
          seen.add(key);
          cleaned.push(text);
          if (cleaned.length >= 14) break;
        }
        extraction.requirements = cleaned;
        return { role: role.trim(), requirements: cleaned };
      },
    }),

    // 2.3b — the assessment. The CONTENT is model-generated; what happens to it
    // afterwards is not. `reconcileRoleFit` adds a row for any requirement this
    // call skipped, downgrades any positive verdict that cites nothing valid,
    // runs Sprint 3's checker over each row's evidence, and refuses to return an
    // assessment that has unmet rows and no gaps. See lib/role-fit.ts.
    roleFit: tool({
      description:
        "Show a structured, per-requirement assessment of Sidhant against a role — a pasted job posting, or a role the user names (e.g. GTM engineer, solutions engineer, RevOps). One row per requirement, each with a verdict and, where it claims a fit, the chunk ids it stands on.",
      inputSchema: z.object({
        role: z
          .string()
          .describe(
            "The role as the posting titles it, or as the user phrased it — e.g. 'GTM engineer', 'RevOps analyst'.",
          ),
        // NAMED `rows`, NOT `requirements`, AND TYPED LOOSELY ON PURPOSE.
        //
        // Both halves of a job-description turn are in the same context, and
        // the first one filled a field called `requirements` with strings. Ask
        // the second for a field of the same name and a real model will hand
        // back the same array — measured, not guessed: the first live run of
        // this sprint failed four of six postings with an input-validation
        // error, which arrives as a turn that answers in prose with no
        // assessment behind it. That is the Stage 0 bug, rebuilt by hand.
        //
        // So the field has a different name, `verdict` is a plain string rather
        // than an enum, and a row may arrive as a bare string. Nothing here can
        // reject a generation. lib/role-fit.ts normalizes what comes back and
        // downgrades whatever doesn't hold up — enforcement lives there, where
        // failing means a marked row instead of a lost answer.
        // Optional, like everything else here: a missing key must not cost the
        // turn. When the assessment arrives empty, coverage still fills the
        // table from the extraction — every requirement as an unanswered row,
        // which is a visible degradation rather than a silent one.
        rows: rowSchema
          .optional()
          .describe(
            "One object per requirement, in the posting's order — NOT a list of strings, and not a copy of the extraction. Answer every requirement that was extracted, including the ones he does not meet.",
          ),
        // The same list under the name the model reaches for when it slips back
        // into the extraction's vocabulary. Measured, again: a run after the
        // rename still lost one posting to a missing `rows` key, because the
        // object arrived under `requirements`. Accepting both costs a line;
        // rejecting one costs the assessment.
        requirements: rowSchema
          .optional()
          .describe("Alias for `rows`. Prefer `rows`."),
        verdict: z
          .string()
          .describe(
            "One line a recruiter could read on its own: where he fits, and what the real question is.",
          ),
        gaps: z
          .array(z.string())
          .describe(
            "Every requirement he does not meet, stated plainly, one per entry. This is the part of the assessment a recruiter is reading for — do not soften, merge, or dissolve them.",
          ),
        noGapsRationale: z
          .string()
          .optional()
          .describe(
            "Only when `gaps` is genuinely empty: why a posting with no unmet requirement is a real outcome and not an oversight.",
          ),
      }),
      // The model's object goes in; what the site is prepared to render comes
      // out. `extraction.requirements` is empty on a turn that was a question
      // rather than a posting, which is exactly when coverage does not apply.
      execute: async (raw) => reconcileRoleFit(raw, extraction.requirements, CHUNK_BY_ID),
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
}

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

  // (e2) A posting goes to the model fenced, labeled as data, and with the
  // untrusted-input rules restated underneath it (Sprint 4, bank §6 Stage 2).
  // It happens HERE, on the user message, and never in the system prompt: that
  // string has to stay byte-identical across requests or the cache that makes
  // every turn cheap stops hitting.
  const outgoing = jobPosting ? messages.map(hardenPosting(messages)) : messages;

  // This request's extraction, closed over by both job-description tools.
  const extraction = { requirements: [] as string[] };
  const chatTools = buildChatTools(extraction);

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
        // Four, because a job-posting turn now spends three of them: extract,
        // judge, then the sentence that follows.
        stopWhen: stepCountIs(4),
        // THE JD FIX (Sprint 1), now in two stages (Sprint 4). On a
        // job-posting turn the structured assessment is the feature, so it is
        // not left to the model's discretion: step 0 extracts the posting's
        // requirements, step 1 judges them, and every step after that gets
        // `toolChoice: "none"` — without that, a forced choice applies to every
        // step and the model calls the tool again instead of writing the
        // sentence that follows it.
        //
        // Non-JD turns are untouched: `undefined` means "use the outer
        // setting", which is the default `auto`.
        prepareStep: jobPosting
          ? ({ stepNumber }) => {
              if (stepNumber === 0) {
                return { toolChoice: { type: "tool", toolName: "extractRequirements" } };
              }
              if (stepNumber === 1) {
                return { toolChoice: { type: "tool", toolName: "roleFit" } };
              }
              return { toolChoice: "none" };
            }
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
          ...(await convertToModelMessages(outgoing as Omit<UIMessage, "id">[])),
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
