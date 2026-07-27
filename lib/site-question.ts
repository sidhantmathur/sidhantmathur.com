// Recognising a question about the site itself (roadmap Sprint 7, #8/#9).
//
// WHY THIS EXISTS
//
// The second corpus — this repo, chunked under `repo:` ids — cannot ride in the
// system prompt on every turn. The knowledge base is concatenated
// byte-identically into the prompt precisely so the provider's cache hits, and
// doubling that string to answer a question nobody asked would show up as real
// money in Sprint 2's cost meter on every ordinary turn.
//
// So the corpus is appended only on the turns that need it, and something has
// to decide, server-side, that a turn is one of those. Same shape as
// lib/job-posting.ts, and the same asymmetry: a false positive costs a bigger
// prompt on one turn, a false negative costs an answer that either declines a
// legitimate question or answers it with nothing behind it. Fire eagerly.
//
// The deliberate paths — the `/roast` and `/site` slash commands — are covered
// by a static test asserting the exact message each one sends is detected here,
// rather than by a magic prefix. Sprint 4 needed a prefix because a pasted
// posting looks like anything; a question about the site says so in words.

/**
 * Any one of these, anywhere in the message, makes it a site turn.
 *
 * Deliberately about THIS artifact — "this site", "your prompt", "the repo" —
 * rather than about software in general. "How do you handle rate limiting?" as
 * a general engineering question is still out of scope and still declined; the
 * same words about this site are not.
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

/** Below this, one signal still counts — questions about the site are short. */
export function looksLikeSiteQuestion(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return SIGNALS.some((s) => s.test(t));
}

/**
 * The message `/roast` sends, shown in the conversation as the visitor's own
 * turn — so it is written as a question a person would ask, not as a prompt
 * fragment. The hard part of a roast is asking for specifics; the model will
 * happily produce affectionate nonsense otherwise.
 */
export const ROAST_REQUEST =
  "Roast this site. Use the repo — name the specific choices, files and trade-offs that are actually weak, not the flattering kind of criticism.";

/** The message `/site` sends. */
export const SITE_REQUEST =
  "How is this site built, and what runs on each request?";
