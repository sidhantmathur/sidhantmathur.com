// The URL-fragment permalink (roadmap Sprint 5, #18).
//
// WHY THERE IS NO DATABASE HERE. The conversation is deflated and base64url'd
// into the URL **fragment**, and fragments are client-only by spec: they are
// never sent in the HTTP request. The page a permalink opens is the same static
// file the site already serves; JavaScript then reads the hash and replays. So
// there is nothing to persist, no key to expire, no per-use cost, and the
// static-first rule in CLAUDE.md survives intact.
//
// WHY THERE IS NO DEPENDENCY HERE. `CompressionStream('deflate-raw')` is native
// in every browser the site targets and in Node 18+, so lz-string — the one
// library this feature would otherwise have wanted — buys nothing. That is the
// whole dependency conversation for #18, and the answer is none. (Node having
// it too is what lets evals/export.test.mjs round-trip a real payload under
// `node --test` rather than trusting the encoder by inspection.)
//
// WHAT IT IS NOT. base64 is encoding, not encryption. Anyone holding the link
// reads the conversation, and the surface that generates one has to say so.

import {
  fromSnapshot,
  toSnapshot,
  type TranscriptMessage,
  type TranscriptSnapshot,
} from "./transcript.ts";

/** The fragment key. `#c=` — c for conversation. */
export const PERMALINK_PREFIX = "#c=";

/**
 * The length past which mail clients and chat unfurlers start mangling a URL.
 *
 * Measured against the site's own limits in docs/idea-decisions.md: a 12-turn
 * transcript encoded to ~1,700 characters, and the route caps a conversation at
 * 10 user turns. So an ordinary conversation cannot reach this — but a pasted
 * job posting and a full requirement table can, which is exactly why the number
 * is reported to the reader rather than assumed away.
 */
export const PERMALINK_SAFE_CHARS = 2000;

/**
 * Hard ceiling on an INCOMING payload, before it is decompressed.
 *
 * A fragment arrives from whoever sent the link. This bounds the work a hostile
 * one can ask for; the decoder bounds the output as well.
 */
const MAX_PAYLOAD_CHARS = 64_000;
const MAX_DECODED_BYTES = 512_000;

// --- base64url ------------------------------------------------------------
//
// Hand-rolled over btoa/atob rather than Buffer so the same code runs in the
// browser and under `node --test`. Chunked because a spread of a 100 kB byte
// array into String.fromCharCode overflows the argument limit.

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// --- deflate --------------------------------------------------------------

// The lib.dom type for CompressionStream is `TransformStream<BufferSource,
// Uint8Array>`, which does not unify with the DecompressionStream one under a
// single generic parameter. Typed structurally instead, on the two properties
// this function actually uses.
type ByteStream = {
  writable: WritableStream<Uint8Array>;
  readable: ReadableStream<Uint8Array>;
};

async function pipe(bytes: Uint8Array, stream: ByteStream) {
  const writer = stream.writable.getWriter();
  // The write and close promises are deliberately not awaited — the reader
  // below is what drains the stream — but they MUST be caught. On a corrupt
  // payload the inflater errors both ends, and an uncaught rejection on the
  // writable side surfaces as an unhandledRejection long after decodeSnapshot
  // has already returned its honest `null`. (Found by the truncated-link test,
  // which is exactly the case a mail client produces.)
  const ignore = () => {};
  writer.write(bytes).catch(ignore);
  writer.close().catch(ignore);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    if (total > MAX_DECODED_BYTES) throw new Error("permalink payload too large");
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Whether this runtime can make or read a permalink at all. */
export function permalinkSupported(): boolean {
  return typeof CompressionStream === "function" && typeof DecompressionStream === "function";
}

/** A conversation → the fragment payload. */
export async function encodeSnapshot(snapshot: TranscriptSnapshot): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(snapshot));
  const deflated = await pipe(json, new CompressionStream("deflate-raw") as unknown as ByteStream);
  return toBase64Url(deflated);
}

/** The fragment payload → a conversation, or null if it isn't one. */
export async function decodeSnapshot(payload: string): Promise<TranscriptMessage[] | null> {
  if (!payload || payload.length > MAX_PAYLOAD_CHARS) return null;
  const bytes = fromBase64Url(payload);
  if (!bytes) return null;
  try {
    const inflated = await pipe(bytes, new DecompressionStream("deflate-raw") as unknown as ByteStream);
    const messages = fromSnapshot(JSON.parse(new TextDecoder().decode(inflated)));
    return messages.length ? messages : null;
  } catch {
    // Truncated by a mail client, hand-edited, or from a future version of the
    // format. All three are the same event to a reader: this link doesn't
    // open, and the site's ordinary empty state is the honest response.
    return null;
  }
}

/** The whole link, for a given origin+path. */
export async function permalinkFor(
  base: string,
  messages: TranscriptMessage[],
): Promise<string> {
  const payload = await encodeSnapshot(toSnapshot(messages));
  return `${base}${PERMALINK_PREFIX}${payload}`;
}

/** The payload in a `location.hash`, if there is one. */
export function payloadFromHash(hash: string): string | null {
  if (!hash.startsWith(PERMALINK_PREFIX)) return null;
  const payload = hash.slice(PERMALINK_PREFIX.length);
  return payload || null;
}
