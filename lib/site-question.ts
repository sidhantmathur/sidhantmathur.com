// Recognising a question about the site itself.
//
// The second corpus, this repo chunked under `repo:` ids, can't ride in the
// system prompt on every turn. The base prompt is byte-identical across requests
// so the provider's cache hits, and carrying the repo on every turn would bill
// for it on turns that never asked. So it is appended only on turns that need
// it, and this decides, server-side, which those are.
//
// Same shape as lib/job-posting.ts, and the same asymmetry: a false positive
// costs a bigger prompt on one turn, a false negative an answer that declines a
// legitimate question or answers it with nothing behind it. Fire eagerly.
//
// The `/roast` and `/site` commands send fixed messages, and
// evals/recursion.test.mjs asserts both are detected here, so neither needs a
// magic prefix.

/**
 * Any one of these, anywhere in the message, makes it a site turn.
 *
 * About this site ("this site", "your prompt", "the repo") rather than software
 * in general: "how do you handle rate limiting?" as a general engineering
 * question is still out of scope and still declined.
 */
const SIGNALS: RegExp[] = [
  /\b(?:this|the|your) (?:site|website|page|app|chat|chatbot|assistant|codebase|repo|repository)\b/i,
  /\b(?:the|this) (?:source|source code|prompt|system prompt|knowledge base|corpus|eval suite|evals)\b/i,
  /\byour (?:prompt|instructions|system prompt|rules|guardrails|knowledge base|source|code)\b/i,
  /\broast\b/i,
  /\bhow (?:were|are|was|is) (?:you|this|it) (?:built|made|put together|architected)\b/i,
  /\bwho (?:built|made|wrote) (?:you|this|it)\b/i,
  /\bwhat (?:are|is) (?:you|this|it) (?:built|made|running) (?:on|with|from)\b/i,
  /\bwhat (?:won'?t|will not|can'?t|cannot) (?:you|it) (?:do|answer|say)\b/i,
  /\b(?:prompt cache|token budget|rate limit(?:ing|s)?|cost meter|citation checker)\b/i,
];

/** True when any signal matches. No length floor: questions about the site are short. */
export function looksLikeSiteQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return SIGNALS.some((s) => s.test(t));
}

/**
 * The message `/roast` sends. It shows in the conversation as the visitor's own
 * turn, so it reads as a question a person would ask. It asks for specifics
 * because without them the model produces affectionate nonsense.
 */
export const ROAST_REQUEST =
  "Roast this site using the repo. Name the specific choices, files and trade-offs that are weak, and don't go easy on it.";

/** The message `/site` sends. */
export const SITE_REQUEST =
  "How is this site built, and what runs on each request?";
