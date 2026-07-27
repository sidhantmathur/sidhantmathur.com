// Reads the repo's build artifacts and source files so the static evals can
// assert on them without importing TypeScript.
//
// The generated modules are JSON.stringify output wrapped in an export, so
// parsing them back out is exact rather than approximate. The hand-written
// sources (route.ts, app-shell.tsx) are read as text and pattern-matched —
// coarser, but it means a check can cover a plain array literal that no runtime
// boundary exposes. The client/server model-allowlist check below is exactly
// that case, and it's a documented footgun (docs/followups.md §2): a mismatch
// silently falls back to the default model rather than erroring.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

/** The concatenated knowledge base injected into the system prompt. */
export function readKnowledgeBase() {
  const src = read("lib/knowledge.generated.ts");
  const match = src.match(/export const KNOWLEDGE_BASE = ("(?:[^"\\]|\\.)*");/s);
  if (!match) {
    throw new Error(
      "Could not parse KNOWLEDGE_BASE from lib/knowledge.generated.ts — run `node scripts/build-knowledge.mjs` first.",
    );
  }
  return JSON.parse(match[1]);
}

/** The addressable corpus — every chunk of content/knowledge, with its id. */
export function readChunks() {
  const src = read("lib/chunks.generated.ts");
  const match = src.match(/export const CHUNKS: Chunk\[\] = (\[[\s\S]*?\n\]);/);
  if (!match) {
    throw new Error(
      "Could not parse CHUNKS from lib/chunks.generated.ts — run `node scripts/build-knowledge.mjs` first.",
    );
  }
  return JSON.parse(match[1]);
}

/** Raw source of the system-prompt builder. */
export function readSystemPromptSource() {
  return read("lib/system-prompt.ts");
}

/**
 * The assembled system prompt, reconstructed the same way buildSystemPrompt()
 * does: the template literal with ${KNOWLEDGE_BASE} substituted.
 *
 * This mirrors the TS rather than importing it, so it can drift. The structural
 * assertions in static.test.mjs are what catch that: they check the real source
 * for each required section, so a section that moved or vanished fails there
 * regardless of what this reconstruction does.
 */
export function buildPromptApproximation() {
  const src = readSystemPromptSource();
  const start = src.indexOf("return `");
  const end = src.lastIndexOf("`;");
  if (start === -1 || end === -1) {
    throw new Error("Could not locate the prompt template in lib/system-prompt.ts");
  }
  const template = src.slice(start + "return `".length, end);
  return template
    .replace("${KNOWLEDGE_BASE}", readKnowledgeBase())
    .replace(/\\`/g, "`")
    .replace(/\\\$/g, "$");
}

/** Model ids on the server allowlist, with their tiers. */
export function readServerModels() {
  const src = read("app/api/chat/route.ts");
  const block = src.match(/const MODELS = \{([\s\S]*?)\} as const;/);
  if (!block) throw new Error("Could not locate MODELS in app/api/chat/route.ts");
  const models = {};
  for (const m of block[1].matchAll(/"([^"]+)":\s*\{\s*tier:\s*"(\w+)"/g)) {
    models[m[1]] = m[2];
  }
  return models;
}

/** Model ids the client offers in the picker. */
export function readClientModels() {
  const src = read("components/shell/app-shell.tsx");
  const block = src.match(/const MODELS = \[([\s\S]*?)\];/);
  if (!block) throw new Error("Could not locate MODELS in components/shell/app-shell.tsx");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** The model the route falls back to for an unknown id. */
export function readDefaultModel() {
  const src = read("app/api/chat/route.ts");
  const match = src.match(/const DEFAULT_MODEL: ModelId = "([^"]+)";/);
  if (!match) throw new Error("Could not locate DEFAULT_MODEL in app/api/chat/route.ts");
  return match[1];
}

/** Tier names that have a rate-limit bucket. */
export function readTierLimits() {
  const src = read("app/api/chat/route.ts");
  const block = src.match(/const TIER_LIMITS: Record<Tier, number> = \{([\s\S]*?)\};/);
  if (!block) throw new Error("Could not locate TIER_LIMITS in app/api/chat/route.ts");
  const limits = {};
  for (const m of block[1].matchAll(/(\w+):\s*(\d+)/g)) limits[m[1]] = Number(m[2]);
  return limits;
}

/** Tool names defined on the chat route. */
export function readToolNames() {
  const src = read("app/api/chat/route.ts");
  const block = src.match(/const chatTools = \{([\s\S]*?)\n\};/);
  if (!block) throw new Error("Could not locate chatTools in app/api/chat/route.ts");
  return [...block[1].matchAll(/^ {2}(\w+):\s*tool\(/gm)].map((m) => m[1]);
}

/**
 * The closed error vocabulary in lib/chat-telemetry.ts, read from the runtime
 * narrowing list rather than the type — a TS union has nothing to import at
 * runtime, and the two are asserted equal by the type checker anyway.
 */
export function readErrorClasses() {
  const src = read("lib/chat-telemetry.ts");
  const block = src.match(/const known: TurnErrorClass\[\] = \[([\s\S]*?)\];/);
  if (!block) throw new Error("Could not locate the error-class list in lib/chat-telemetry.ts");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Classes the route's failure theatre will reproduce on demand. */
export function readSimulatableClasses() {
  const src = read("app/api/chat/route.ts");
  const block = src.match(/const SIMULATABLE: TurnErrorClass\[\] = \[([\s\S]*?)\];/);
  if (!block) throw new Error("Could not locate SIMULATABLE in app/api/chat/route.ts");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Classes the failure-theatre UI offers a button for. */
export function readFailureTheatreClasses() {
  const src = read("components/shell/instruments.tsx");
  const block = src.match(/const FAILURES: FailureSpec\[\] = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error("Could not locate FAILURES in components/shell/instruments.tsx");
  return [...block[1].matchAll(/cls:\s*"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Rough token estimate. Deliberately crude — this backstops the ~8k budget the
 * build script targets, and a 4-chars-per-token approximation is accurate
 * enough to catch a corpus that doubled, which is the only failure worth
 * alerting on.
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
