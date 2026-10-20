// The URL-fragment permalink. The conversation is deflated and base64url-encoded
// into the URL fragment, which is never sent in the HTTP request. A permalink
// opens the same static page the site already serves, and JavaScript reads the
// hash and replays it. Nothing is stored server-side, so there is nothing to
// persist or expire, and no per-use cost.
//
// No dependency: `CompressionStream('deflate-raw')` is native in every browser
// the site targets and in Node 18+, which also lets evals/export.test.mjs
// round-trip a real payload under `node --test`.
//
// base64 is encoding, not encryption. Anyone holding the link can read the
// conversation, and the surface that generates one has to say so.

import {
  fitSnapshot,
  fromSnapshot,
  toSnapshot,
  type TranscriptMessage,
  type TranscriptSnapshot,
} from "./transcript.ts";

/** The fragment key. `#c=` — c for conversation. */
export const PERMALINK_PREFIX = "#c=";

/**
 * The length past which mail clients and chat unfurlers start mangling a URL.
 * An ordinary conversation can't reach it (docs/idea-decisions.md: a 12-turn
 * transcript encoded to about 1,700 characters, and the route caps a
 * conversation at 10 user turns), but one with a full requirement table can, so
 * the length is reported to the reader rather than assumed.
 */
export const PERMALINK_SAFE_CHARS = 2000;

/**
 * Ceiling on an incoming payload before it is decompressed. A fragment comes
 * from whoever sent the link; this bounds the work a hostile one can ask for,
 * and MAX_DECODED_BYTES bounds the output.
 */
const MAX_PAYLOAD_CHARS = 64_000;
const MAX_DECODED_BYTES = 512_000;

// --- base64url ------------------------------------------------------------
//
// Over btoa/atob rather than Buffer so the same code runs in the browser and
// under `node --test`. Chunked because spreading a 100 kB byte array into
// String.fromCharCode overflows the argument limit.

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

// lib.dom types CompressionStream as `TransformStream<BufferSource, Uint8Array>`,
// which doesn't unify with DecompressionStream under one generic parameter, so
// this is typed structurally on the two properties pipe() uses.
type ByteStream = {
  writable: WritableStream<Uint8Array>;
  readable: ReadableStream<Uint8Array>;
};

async function pipe(bytes: Uint8Array, stream: ByteStream) {
  const writer = stream.writable.getWriter();
  // The write and close promises aren't awaited (the reader below drains the
  // stream) but must be caught: on a corrupt or truncated payload the inflater
  // errors both ends, and an uncaught rejection on the writable side surfaces
  // as an unhandledRejection after decodeSnapshot has already returned null.
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
    // Truncated by a mail client or hand-edited. Either way the link doesn't
    // open, and the site shows its ordinary empty state.
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

/**
 * The short fit link: the latest fit check in scorecard shape (see
 * `fitSnapshot`), for the places a whole conversation won't fit — an ATS field,
 * a plain-text email. Null when there is no fit check to make one from.
 */
export async function fitPermalinkFor(
  base: string,
  messages: TranscriptMessage[],
): Promise<string | null> {
  const snapshot = fitSnapshot(messages);
  if (!snapshot) return null;
  return `${base}${PERMALINK_PREFIX}${await encodeSnapshot(snapshot)}`;
}

/**
 * The payload in a `location.hash`, if there is one. Anything from the first `?`
 * or `&` on is not payload; base64url contains neither, so the cut is
 * unambiguous. That keeps the likeliest mistake with an application link,
 * `?ref=acme` pasted onto the end of a copied permalink, from breaking the
 * link. lib/analytics.ts reads the ref from there; this ignores it.
 * docs/application-links.md has the right order.
 */
export function payloadFromHash(hash: string): string | null {
  if (!hash.startsWith(PERMALINK_PREFIX)) return null;
  const payload = hash.slice(PERMALINK_PREFIX.length).split(/[?&]/, 1)[0];
  return payload || null;
}
