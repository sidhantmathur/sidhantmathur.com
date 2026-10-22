// Stored answers for the questions the site asks on the visitor's behalf.
//
// The three suggested chips and the two slash commands that send a fixed
// message are the same request every time: one user turn, a string the site
// wrote, and a system prompt that is byte-identical across requests. Generated
// live, they cost each visitor the same wait the visitor before them already
// sat through. On production (2026-10-22) the role-fit chip took 7.5–16 s to
// show anything and 10–21 s to finish; the other two chips about 2.3 s to the
// first word. The prompt cache was already hitting, so the wait was generation,
// and only not generating removes it.
//
// So the first clean answer to each is kept and later visitors get it at once.
// What makes that safe to serve:
//
//   - Fixed questions only, and only as the opening turn. A typed question, a
//     follow-up or anything carrying history is never looked up and never
//     stored, so nothing a visitor wrote is kept or shown to anyone else.
//   - Keyed by deployment, model and the exact system prompt. A deploy, an edit
//     to the knowledge base or a different model in the picker all land on a
//     different key, so an answer can't outlive the code and content that
//     produced it.
//   - Kept only if it passed: finished on `stop`, no error, and every checkable
//     sentence verified against the chunk it cited (lib/verify.ts). An answer
//     the site would mark "not in source" still reaches the visitor who got it,
//     but nobody else; the next visitor gets a fresh attempt.
//   - Said, not hidden. The turn's record carries `stored`, the header receipt
//     reads "cached", and the trace shows when the answer was generated and how
//     long that took.
//
// Free of the `@/` alias and of Next, so evals/stored-answers.test.mjs can load
// it under `node --test`.

import { createHash } from "node:crypto";
import type { UIMessageChunk } from "ai";
import { Redis } from "@upstash/redis";
import { SUGGESTED_QUESTIONS } from "../content/recruiter.ts";
import type { StoredOrigin } from "./chat-telemetry.ts";
import { ROAST_REQUEST, SITE_REQUEST } from "./site-question.ts";
import { verifyAnswer, type VerifiableChunk } from "./verify.ts";

/** Every message the site sends for the visitor, exactly as it sends it. */
export const FIXED_QUESTIONS: ReadonlySet<string> = new Set([
  ...SUGGESTED_QUESTIONS,
  SITE_REQUEST,
  ROAST_REQUEST,
]);

/**
 * A week. The key already changes with every deploy, so this only bounds how
 * long an answer sits on a deployment nobody redeploys.
 */
export const STORED_TTL_SECONDS = 7 * 24 * 60 * 60;

export type StoredAnswer = StoredOrigin & {
  /** The turn as the browser received it, minus what a replay can't use. */
  chunks: UIMessageChunk[];
  steps: number | null;
  toolsCalled: string[] | null;
};

type Part = { type: string; text?: unknown };
type Message = { role: string; parts: readonly Part[] };

/**
 * The fixed question this conversation opens with, or null. Only a
 * conversation that is that question and nothing else qualifies.
 */
export function fixedQuestionOf(messages: readonly Message[]): string | null {
  if (messages.length !== 1) return null;
  const [only] = messages;
  if (only!.role !== "user") return null;
  // A chip is one text part. Anything else (a file, a second part) wasn't sent
  // by a chip, whatever its text says.
  if (only!.parts.length !== 1) return null;
  const [part] = only!.parts;
  if (part!.type !== "text" || typeof part!.text !== "string") return null;
  return FIXED_QUESTIONS.has(part!.text) ? part!.text : null;
}

/**
 * Which deployment this is. Vercel sets both at runtime; locally neither is
 * set, and the system prompt in the key is what separates one edit from the
 * next.
 */
function deploymentId(): string {
  return process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
}

export function storedAnswerKey(turn: {
  model: string;
  systemPrompt: string;
  question: string;
}): string {
  const digest = createHash("sha256")
    .update(turn.model)
    .update("\0")
    .update(turn.systemPrompt)
    .update("\0")
    .update(turn.question)
    .digest("hex")
    .slice(0, 32);
  return `chat:stored:v1:${deploymentId()}:${digest}`;
}

// --- Recording ------------------------------------------------------------
//
// The browser gets every chunk as it streams; the copy kept for later drops
// what a replay can't use. Reasoning never reaches the page. Tool-input deltas
// are the partial JSON the card is typed from, and `tool-input-available`
// carries the whole input. Provider metadata holds the provider's own item
// ids and encrypted reasoning, which belong to the original response, not to
// a later visitor's history. Text deltas are joined per text part, since the
// replay writes them all at once anyway.

const DROPPED = new Set([
  "reasoning-start",
  "reasoning-delta",
  "reasoning-end",
  "tool-input-delta",
]);

/** The chunk as it is worth keeping, or null for one a replay doesn't need. */
export function keptChunk(chunk: UIMessageChunk): UIMessageChunk | null {
  if (DROPPED.has(chunk.type)) return null;
  if (!("providerMetadata" in chunk)) return chunk;
  const copy: Record<string, unknown> = { ...chunk };
  delete copy.providerMetadata;
  return copy as UIMessageChunk;
}

/**
 * A pass-through for the turn's UI stream that keeps a copy. `done` resolves
 * with the copy once the stream has ended, which can be after the model has
 * finished: the browser drains the stream at its own pace.
 */
export function recorder<C extends { type: string }>(): {
  transform: TransformStream<C, C>;
  done: Promise<UIMessageChunk[]>;
} {
  const kept: UIMessageChunk[] = [];
  let resolve!: (chunks: UIMessageChunk[]) => void;
  const done = new Promise<UIMessageChunk[]>((r) => (resolve = r));
  const transform = new TransformStream<C, C>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      const copy = keptChunk(chunk as unknown as UIMessageChunk);
      if (!copy) return;
      const last = kept[kept.length - 1];
      if (copy.type === "text-delta" && last?.type === "text-delta" && last.id === copy.id) {
        kept[kept.length - 1] = { ...last, delta: last.delta + copy.delta };
        return;
      }
      kept.push(copy);
    },
    flush() {
      resolve(kept);
    },
  });
  return { transform, done };
}

/** The answer's text, as the shell joins it (`textOf`) for the checker. */
export function textOfChunks(chunks: readonly UIMessageChunk[]): string {
  return chunks
    .filter((c): c is Extract<UIMessageChunk, { type: "text-delta" }> => c.type === "text-delta")
    .map((c) => c.delta)
    .join("");
}

/**
 * Why a recorded turn isn't fit to serve to someone else, or null when it is:
 * it said something, nothing in it errored, and the citation check the browser
 * would run over it finds nothing to mark. The reason goes to the server log,
 * so a chip that never gets faster says why.
 */
export function unstorableReason(
  chunks: readonly UIMessageChunk[],
  lookup: Record<string, VerifiableChunk>,
): string | null {
  const failed = chunks.find(
    (c) => c.type === "error" || c.type === "abort" || c.type.endsWith("-error"),
  );
  if (failed) return `the stream carried ${failed.type}`;
  const text = textOfChunks(chunks);
  if (!text.trim()) return "the answer had no text";
  const check = verifyAnswer(text, lookup);
  if (check.unknownIds.length) return `cited unknown ids: ${check.unknownIds.join(", ")}`;
  if (check.downgraded.length) {
    const verdicts = check.downgraded.map((c) => c.verdict).join(", ");
    return `${check.downgraded.length} sentence(s) failed the citation check (${verdicts})`;
  }
  return null;
}

export function storable(
  chunks: readonly UIMessageChunk[],
  lookup: Record<string, VerifiableChunk>,
): boolean {
  return unstorableReason(chunks, lookup) === null;
}

// --- Where they live -----------------------------------------------------
//
// Upstash when its env vars are set, the same instance the rate limiter uses,
// under its own prefix. Otherwise a Map, which is per instance: fine for
// `npm run dev`, and it means production without Upstash still helps whoever
// lands on a warm instance.

type Store = {
  get(key: string): Promise<StoredAnswer | null>;
  set(key: string, value: StoredAnswer): Promise<void>;
};

function upstashStore(redis: Redis): Store {
  return {
    get: (key) => redis.get<StoredAnswer>(key),
    set: async (key, value) => {
      await redis.set(key, value, { ex: STORED_TTL_SECONDS });
    },
  };
}

function memoryStore(): Store {
  const entries = new Map<string, { value: StoredAnswer; expiresAt: number }>();
  return {
    get: async (key) => {
      const entry = entries.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    set: async (key, value) => {
      entries.set(key, { value, expiresAt: Date.now() + STORED_TTL_SECONDS * 1000 });
    },
  };
}

let store: Store | null = null;

function storeFor(): Store {
  if (!store) {
    store =
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? upstashStore(Redis.fromEnv())
        : memoryStore();
  }
  return store;
}

/**
 * The stored answer, or null. A store that fails reads as empty: the visitor
 * gets a live answer, which is what they'd have had without this.
 */
export async function readStoredAnswer(key: string): Promise<StoredAnswer | null> {
  try {
    const value = await storeFor().get(key);
    return value && Array.isArray(value.chunks) && value.chunks.length ? value : null;
  } catch (err) {
    console.error("[chat] stored answer read failed", err);
    return null;
  }
}

/** Never throws: failing to keep an answer costs the next visitor a wait, nothing more. */
export async function writeStoredAnswer(key: string, value: StoredAnswer): Promise<void> {
  try {
    await storeFor().set(key, value);
  } catch (err) {
    console.error("[chat] stored answer write failed", err);
  }
}
