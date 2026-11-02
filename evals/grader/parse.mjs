// Reads the judge's reply. Strict about the label, lenient about the wrapping:
// a model that fences its JSON or adds a sentence still said something, but a
// label outside the four is an error, never a guess at what it meant.

import { LABELS } from "./prompt.mjs";

const MAX_REASON = 300;

/** The first balanced {...} in `text`, string-aware, or null. */
export function firstObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function oneLine(reason) {
  const line = String(reason ?? "").split("\n")[0].trim();
  return line.length > MAX_REASON ? `${line.slice(0, MAX_REASON - 1)}…` : line;
}

/**
 * `{ label, reason, error }`. `label` is one of LABELS or null; `error` says
 * why it's null. Never throws.
 */
export function parseVerdict(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { label: null, reason: "", error: "empty reply" };
  }
  const body = text.replace(/```(?:json)?/gi, "");
  const json = firstObject(body);
  if (json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { label: null, reason: "", error: "malformed JSON" };
    }
    const label = String(parsed?.label ?? "").trim().toLowerCase();
    if (!label) return { label: null, reason: oneLine(parsed?.reason), error: "no label" };
    if (!LABELS.includes(label)) {
      return { label: null, reason: oneLine(parsed?.reason), error: `unknown label "${label}"` };
    }
    return { label, reason: oneLine(parsed.reason), error: null };
  }
  // No JSON at all: accept a reply that leads with a bare label ("overstated —
  // 'built' for an inherited app"), and nothing looser than that.
  const bare = new RegExp(`^\\s*(${LABELS.join("|")})\\b[\\s:.—–-]*(.*)`, "is").exec(body);
  if (bare) return { label: bare[1].toLowerCase(), reason: oneLine(bare[2]), error: null };
  return { label: null, reason: "", error: "no JSON object" };
}
