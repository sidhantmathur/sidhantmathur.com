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
import { looksLikeJobPosting, MAX_USER_TEXT, wrapPosting } from "@/lib/job-posting";
import { looksLikeSiteQuestion } from "@/lib/site-question";
import { reconcileRoleFit } from "@/lib/role-fit";
import { CHUNK_BY_ID } from "@/lib/chunks.generated";
import {
  SIMULATABLE_CLASSES,
  TURN_FAILURES,
  TURN_PART_ID,
  classifyTurnError,
  type ChatUIMessage,
  type TurnErrorClass,
  type TurnTelemetry,
} from "@/lib/chat-telemetry";
import { INTERNAL_TOOLS } from "@/lib/chat-transport";
import { PROJECTS } from "@/content/projects";
import {
  MODELS,
  DEFAULT_MODEL,
  HOURLY_LIMIT,
  MAX_USER_MESSAGES,
  reasoningFor,
  type ModelId,
} from "@/lib/models";

// Node runtime: @upstash/ratelimit and the in-memory fallback both work there,
// and nothing here needs the edge.
export const runtime = "nodejs";

// The platform's ceiling on a turn. A job-posting turn runs three model steps
// and can go well past the default, and a function killed mid-stream looks the
// same to the browser as a stall. Ninety seconds is above anything measured
// and still bounded: an unbounded turn keeps billing after the reader leaves.
export const maxDuration = 90;

// --- Request validation --------------------------------------------------
//
// useChat (@ai-sdk/react v4, ai v7, v5-era wire format) POSTs UIMessages: an
// `id`, a `role` and a `parts` array. Only user and assistant roles are
// accepted from the client, never `system`. Text parts are summed against a
// per-role cap; other parts pass through untouched.
//
// Assistant turns are the model's own earlier output echoed back as history,
// so they get a loose abuse ceiling rather than the user cap. Capping them
// tightly would turn every follow-up after a long answer into a 400.
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
      // MAX_USER_TEXT is sized for a whole pasted job posting in one message.
      // Abuse is bounded by the hourly budget, not by this cap. The paste
      // panel reads the same constant, so the two can't disagree.
      return textLength <= (msg.role === "user" ? MAX_USER_TEXT : 8000);
    },
    { message: "Message text exceeds the allowed length." },
  );

// --- Model policy ---------------------------------------------------------
//
// Which models exist, what they cost, and the visitor limits (HOURLY_LIMIT,
// MAX_USER_MESSAGES) all live in lib/models.ts; this route enforces them. The
// requested id is only a lookup key into the catalogue, never passed to the
// Gateway, and an unknown id falls back to the default rather than erroring,
// so a stale client can't break the chat.

function resolveModel(requested: string | undefined): ModelId {
  return requested && requested in MODELS ? (requested as ModelId) : DEFAULT_MODEL;
}

const bodySchema = z.object({
  // Room for MAX_USER_MESSAGES visitor turns plus their replies, with
  // headroom, so a long conversation reaches the graceful 429 below rather
  // than a schema 400.
  messages: z.array(messageSchema).min(1).max(30),
  // Validated by lookup rather than as an enum, so a client sending an id the
  // catalogue has dropped gets the default instead of a 400.
  model: z.string().max(100).optional(),
});

// --- Rate limiting -------------------------------------------------------
//
// Per IP, HOURLY_LIMIT turns on a sliding one-hour window. Upstash-backed when
// its env vars are set; otherwise an in-memory Map, so `npm run dev` and a
// local build need no external services. The fallback is per instance and not
// shared across serverless instances, so production rate limiting needs
// UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.

const WINDOW_MS = 60 * 60 * 1000;

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashLimiter = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(HOURLY_LIMIT, "1 h"),
      prefix: "chat:hourly",
    })
  : null;

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

async function consumeBudget(ip: string): Promise<{ ok: boolean; remaining: number }> {
  if (upstashLimiter) {
    const { success, remaining } = await upstashLimiter.limit(ip);
    return { ok: success, remaining: Math.max(0, remaining) };
  }
  return inMemoryConsume(ip, HOURLY_LIMIT);
}

function getClientIp(req: Request): string {
  // Vercel sets x-forwarded-for; the first entry is the original client.
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
// 600 tokens suits a conversational answer. A job-posting turn has to fit an
// extraction, a whole `roleFit` object and the sentence after it, and a turn
// truncated mid-tool-call loses the tool call entirely.
//
// The posting ceiling comes from measurement: a reasoning model spends the
// per-step budget on reasoning before it emits the tool call. At 1000,
// `openai/gpt-5-mini` finished three of five postings on
// `finishReason: "length"` with nothing to show; at 2500 it spent 2,496 tokens
// reasoning on the extraction step alone and emitted nothing. It's a ceiling,
// not a target: non-reasoning models still answer in about 500.
const MAX_OUTPUT_TOKENS = 600;
const MAX_OUTPUT_TOKENS_JD = 4000;

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

/** The last user turn's text, which is what the job-posting detector reads. */
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
// Tools the model can call to render cards in the chat. The client renders each
// as a typed `tool-<name>` part once `part.state === "output-available"`.
// `ai@7` uses the v5-era `tool()` API: schemas go under `inputSchema`, not
// `parameters`. No `execute` does I/O beyond reading bundled static content.
//
// A pasted job posting takes two calls:
//
//   extractRequirements  the posting's requirements, verbatim, before anything
//                        has an opinion about them
//   roleFit              a verdict per requirement, each positive one citing a
//                        chunk id, plus the gaps
//
// Asked to extract and judge at once, a model compresses toward a flattering
// summary and quietly drops the requirements it would have to say no to.
// Extracting first fixes the list before judging starts, and lib/role-fit.ts
// holds the judgment to it: every extracted requirement gets a row, whether
// the model wrote one or not.

/**
 * One assessed requirement, typed as loosely as it can be and still be useful.
 *
 * A bare string is accepted because models fall into that shape when they echo
 * the extraction step instead of judging it, and a rejected tool call loses the
 * whole assessment. lib/role-fit.ts normalizes whatever arrives and marks what
 * doesn't hold up.
 */
const rowSchema = z.array(
  z.union([
    z.object({
      requirement: z
        .string()
        .describe(
          "The requirement in the POSTING's words, copied from the extraction step. When no posting was pasted, a short requirement the named role implies, phrased as a posting would list it (e.g. 'Own sales reporting and analytics'), never as a sentence about the role.",
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

// Built per request because the judging tool has to see what the extracting
// tool produced. `extraction` is that hand-off: one request's requirement list,
// closed over by both tools and never shared between requests.
function buildChatTools(extraction: { requirements: string[] }) {
  return {
    // The model only picks the slug; all card copy comes from
    // content/projects.ts, never from the model.
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

    // resume.pdf ships in public/, so the PDF is always available.
    showResume: tool({
      description: "Show a card to download or view the resume.",
      inputSchema: z.object({}),
      execute: async () => ({
        htmlHref: "/resume",
        pdfHref: "/resume.pdf",
        pdfAvailable: true,
      }),
    }),

    // Extraction only: no verdicts, no evidence. Its output isn't rendered; it
    // feeds the roleFit call and the coverage check after it.
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

    // The content is model-generated; what happens to it afterwards isn't.
    // `reconcileRoleFit` (lib/role-fit.ts) adds a row for any requirement this
    // call skipped, downgrades any positive verdict that cites nothing valid,
    // runs the claim checker in lib/verify.ts over each row's evidence, and
    // refuses an assessment that has unmet rows and no gaps.
    roleFit: tool({
      description:
        "Show a structured, per-requirement assessment of Sidhant against a role — a pasted job posting, or a role the user names (e.g. GTM engineer, solutions engineer, RevOps). One row per requirement, each with a verdict and, where it claims a fit, the chunk ids it stands on.",
      inputSchema: z.object({
        role: z
          .string()
          .describe(
            "The role as the posting titles it, or as the user phrased it — e.g. 'GTM engineer', 'RevOps analyst'.",
          ),
        // Named `rows`, not `requirements`, and typed loosely on purpose. Both
        // tool calls share a context, and the extraction filled a field called
        // `requirements` with strings. Asked for a field of the same name, real
        // models hand back the same array, and the validation error arrives as
        // a prose answer with no assessment behind it (four of six postings on
        // the first live run). So the field has a different name, `verdict` is
        // a plain string rather than an enum, and a row may be a bare string.
        // Nothing here can reject a generation: lib/role-fit.ts normalizes and
        // downgrades instead, where failing means a marked row rather than a
        // lost answer.
        //
        // Optional too, because a missing key must not cost the turn. When the
        // assessment arrives empty, coverage still fills the table from the
        // extraction, one unanswered row per requirement.
        rows: rowSchema
          .optional()
          .describe(
            "One object per requirement, in the posting's order — NOT a list of strings, and not a copy of the extraction. Answer every requirement that was extracted, including the ones he does not meet.",
          ),
        // The same list under the name models reach for when they slip back
        // into the extraction's vocabulary; a run after the rename still lost a
        // posting that way. Accepting both costs a line; rejecting one costs
        // the assessment.
        requirements: rowSchema
          .optional()
          .describe("Alias for `rows`. Prefer `rows`."),
        verdict: z
          .string()
          .describe(
            "One line, under 25 words, a recruiter could read on its own: what matches first, then what the ramp would be. Never describes a requirement more strongly than its row, never opens with a grade, and when most rows are unmet says the core of the role is outside the record instead of calling it a ramp.",
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
      // rather than a posting, which is exactly when coverage doesn't apply.
      execute: async (raw) => reconcileRoleFit(raw, extraction.requirements, CHUNK_BY_ID),
    }),

    // The fixed footer links. Contact goes through email and social here; the
    // phone number is on /resume, and salary and address stay private.
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

// --- Failure theatre ------------------------------------------------------
//
// `?simulate=<class>` reproduces each failure path on demand: 400 for a bad
// body, 429 for the conversation cap and the hourly budget, 502 for a missing
// key, a mid-stream failure that arrives as an error chunk on an HTTP 200, and
// a turn that finishes with nothing in it. Three rules make it safe to leave
// on in production:
//
//   1. It never calls the model and never consumes the visitor's budget.
//   2. It can only produce failures, never an answer, and the class is looked
//      up in a closed list. An unrecognised value is ignored and the request
//      proceeds as a normal turn.
//   3. It takes the same exits as the real thing: `jsonError` for the early
//      classes, and a real throw inside `createUIMessageStream` for the
//      mid-stream ones, so the response is genuinely a 200 whose stream
//      carries an error chunk.

// The classes come from the table in lib/chat-telemetry.ts. SIMULATABLE_CLASSES
// excludes `network`: that one is raised in the browser before the request
// reaches this file, so there's no exit here to take.
function simulatedClass(req: Request): TurnErrorClass | null {
  const value = new URL(req.url).searchParams.get("simulate");
  const match = SIMULATABLE_CLASSES.find((c) => c === value);
  return match ?? null;
}

/** The opening record of a simulated turn: full budget, nothing measured yet. */
function simulatedTelemetry(model: ModelId): TurnTelemetry {
  return {
    model,
    budgetRemaining: HOURLY_LIMIT,
    budgetLimit: HOURLY_LIMIT,
    jobPosting: false,
    siteQuestion: false,
    usage: null,
    timing: null,
    steps: null,
    toolsCalled: null,
    finishReason: null,
    error: null,
  };
}

/**
 * The mid-stream half: HTTP 200, a real stream, a real throw. The client
 * receives the same error chunk and the same closing telemetry record as it
 * would for a Gateway failure.
 */
function simulateStreamFailure(cls: TurnErrorClass, model: ModelId): Response {
  const startedAt = Date.now();
  const telemetry = simulatedTelemetry(model);

  const stream = createUIMessageStream<ChatUIMessage>({
    // Returned as is rather than run through `classifyTurnError`: the class is
    // the input here, and pattern-matching it again could only show the wrong
    // one. What's exercised is the transport, a 200 whose stream ends in an
    // error chunk, and that part is real.
    onError: () => cls,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      // A copy per frame, not the live object. Nothing yields between these
      // writes (the real path awaits the model in between), so a shared
      // reference would still be unserialised when the next line sets `error`.
      // The client tests `usage == null && error == null` for an opening frame,
      // so it would read this one as a closing write and replace the previous
      // turn's record in the instrument log instead of appending this one.
      writer.write({ type: "data-turn", id: TURN_PART_ID, data: { ...telemetry } });
      telemetry.error = { class: cls, detail: "simulated" };
      telemetry.timing = { ttftMs: null, durationMs: Date.now() - startedAt, tokensPerSecond: null };
      writer.write({ type: "data-turn", id: TURN_PART_ID, data: { ...telemetry } });
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

/**
 * The empty turn, which is not a throw at all. A real one is a clean stream:
 * the model reasons, runs out of room and finishes, and nothing errors on the
 * server. So the simulation is a clean stream too — reasoning, the closing
 * record, `finish` — and the browser's transport has to notice on its own that
 * nothing in it reached the page. That is the exit being exercised.
 */
function simulateEmptyTurn(model: ModelId): Response {
  const startedAt = Date.now();
  const telemetry = simulatedTelemetry(model);

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-turn", id: TURN_PART_ID, data: { ...telemetry } });
      writer.write({ type: "reasoning-start", id: "simulated" });
      writer.write({ type: "reasoning-delta", id: "simulated", delta: "(simulated reasoning)" });
      writer.write({ type: "reasoning-end", id: "simulated" });
      telemetry.steps = 1;
      telemetry.toolsCalled = [];
      telemetry.finishReason = "length";
      telemetry.error = { class: "empty_answer", detail: "simulated" };
      telemetry.timing = { ttftMs: null, durationMs: Date.now() - startedAt, tokensPerSecond: null };
      writer.write({ type: "data-turn", id: TURN_PART_ID, data: { ...telemetry } });
      writer.write({ type: "finish" });
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "x-model": model, "x-simulated": "empty_answer" },
  });
}

export async function POST(req: Request): Promise<Response> {
  // (0) Failure theatre comes first: no body parsing, no budget, no model.
  const simulate = simulatedClass(req);
  if (simulate) {
    // A status means an early exit — a JSON body before a stream exists. Null
    // means the failure belongs mid-stream, on an HTTP 200.
    const status = TURN_FAILURES[simulate].simulateStatus;
    if (status) return jsonError(simulate, status);
    if (simulate === "empty_answer") return simulateEmptyTurn(DEFAULT_MODEL);
    return simulateStreamFailure(simulate, DEFAULT_MODEL);
  }

  // (a) Parse and validate the body.
  let parsed: z.infer<typeof bodySchema>;
  try {
    const body = await req.json();
    parsed = bodySchema.parse(body);
  } catch {
    // Malformed request: a generic 400, not the rate-limit state.
    return jsonError("invalid_request", 400);
  }

  const { messages } = parsed;
  const model = resolveModel(parsed.model);

  // (b) Conversation cap: past MAX_USER_MESSAGES visitor messages → rate-limit state.
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  if (userMessageCount > MAX_USER_MESSAGES) {
    return jsonError("rate_limited", 429);
  }

  // (c) Per-IP sliding-window budget, one bucket for every model.
  const ip = getClientIp(req);
  const budget = await consumeBudget(ip);
  if (!budget.ok) {
    return jsonError("rate_limited", 429);
  }

  // (d) A missing AI_GATEWAY_API_KEY returns a structured 502, never a stack
  // trace or a 500, and distinct from the 429s so the client can tell "capped"
  // from "broken". It's checked up front because the Gateway's auth failure
  // only surfaces mid-stream, as a 200 with the error buried in it. This is
  // also what a local run with an empty .env.local gets: the shell shows its
  // error state.
  if (!process.env.AI_GATEWAY_API_KEY) {
    return jsonError("upstream_unconfigured", 502);
  }

  // (e) Is this a pasted job posting? Decided once, up front, because it
  // changes the output ceiling and forces the tool sequence below.
  const turnText = lastUserText(messages);
  const jobPosting = looksLikeJobPosting(turnText);

  // (e1) A question about the site itself gets this repo's corpus appended to
  // the system prompt, for this turn only. Never on a posting turn: that turn
  // already carries a long posting and three steps, and nobody pasting a job
  // description is asking about the rate limiter.
  //
  // The base prompt is byte-identical either way and the appendix goes after
  // it, so an ordinary turn sends exactly the prefix the provider has cached.
  // That is why this is decided per turn rather than giving everyone a bigger
  // prompt.
  const siteQuestion = !jobPosting && looksLikeSiteQuestion(turnText);

  // (e2) A posting goes to the model fenced, labelled as data, with the
  // untrusted-input rules restated underneath it. That happens here, on the
  // user message, never in the system prompt, which has to stay byte-identical
  // across requests for the prompt cache to hit.
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
    budgetRemaining: budget.remaining,
    budgetLimit: HOURLY_LIMIT,
    jobPosting,
    siteQuestion,
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
      // Copied, for the reason spelled out in simulateStreamFailure: the frame
      // must carry what was true when it was written, and `telemetry` is
      // mutated in place for the rest of this function.
      writer.write({ type: "data-turn", id: TURN_PART_ID, data: { ...telemetry } });

      const result = streamText({
        model, // resolved from the catalogue, never the raw client string
        // Stop, a dropped connection, and the client's own connect timeout and
        // stall watchdog all abort the request. Without this the model would
        // keep generating, and billing, into a socket nobody reads.
        abortSignal: req.signal,
        maxOutputTokens: jobPosting ? MAX_OUTPUT_TOKENS_JD : MAX_OUTPUT_TOKENS,
        // Per model and kind of turn, from the catalogue. Undefined sends
        // nothing and leaves the provider on its default.
        reasoning: reasoningFor(model, { jobPosting }),
        tools: chatTools,
        // The SDK's default, stepCountIs(1), ends the stream at the tool call
        // before the model can answer, and a tool card is a visual aid, not a
        // replacement for the answer. Four, because a posting turn spends
        // three: extract, judge, then the sentence that follows.
        stopWhen: stepCountIs(4),
        // On a posting turn the structured assessment is the feature, so it
        // isn't left to the model: step 0 must extract, step 1 must judge, and
        // every later step gets `toolChoice: "none"`. Otherwise a forced choice
        // applies to every step and the model calls the tool again instead of
        // writing the sentence after it. Other turns keep the default, `auto`.
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
        // Supplied as a message so it can carry cache_control. The base prompt
        // is byte-identical across requests, so ephemeral caching hits after
        // the first.
        allowSystemInMessages: true,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt({ repoCorpus: siteQuestion }),
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
          reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? null,
          totalTokens: usage.totalTokens ?? null,
        };
        // Rounded: the SDK reports fractional milliseconds, and that precision
        // on a network measurement is noise that reads as false exactness on
        // screen.
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

        // A turn that finished and said nothing: usually a reasoning model that
        // spent the whole ceiling thinking and stopped on "length". It billed
        // tokens and produced no answer, so its record says so rather than
        // being priced and logged as an answer. The browser's transport shows
        // the reader the failure (`answerWatcher` in lib/chat-transport.ts);
        // this keeps the record in agreement.
        const said = steps.some(
          (s) =>
            s.text.trim() !== "" ||
            s.toolResults.some((r) => !INTERNAL_TOOLS.has(r.toolName)),
        );
        if (!said) {
          telemetry.error = { class: "empty_answer", detail: finishReason };
        }
      } catch (err) {
        // The merged stream has already surfaced the failure to the reader.
        // This adds the class, so the client can tell a timeout from a
        // misconfiguration.
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

      writer.write({ type: "data-turn", id: TURN_PART_ID, data: { ...telemetry } });
      writer.write({ type: "finish" });
    },
  });

  // The status strip reads the budget from these headers before the first
  // token arrives; the live eval harness reads them too.
  return createUIMessageStreamResponse({
    stream,
    headers: {
      "x-model": model,
      "x-budget-remaining": String(budget.remaining),
      "x-budget-limit": String(HOURLY_LIMIT),
    },
  });
}
