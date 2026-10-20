// The refusal ledger: what the assistant won't do, why, and what it does
// instead. Hand-curated. Every entry describes a rule that exists in this repo
// and names the file holding it; `evals/recursion.test.mjs` fails if an entry's
// anchor text is no longer in that file, so an entry can't outlive its rule.
//
// `enforcedBy` is the column that matters. A refusal in the system prompt holds
// only while the model cooperates, and a determined visitor may talk around it.
// A refusal in the route or a reconciler holds whatever the wording. A ledger
// that hid the difference would claim more than the site can support.
//
// Nothing here asserts anything about Sidhant. The one entry that came from him
// rather than from the code points at the decision that recorded it.

export type RefusalEnforcement =
  /** Written into the system prompt. The model's cooperation is load-bearing. */
  | "prompt"
  /** Written into code. It holds whether the model cooperates or not. */
  | "code"
  /** A decision about what this site is for. Nothing runs; nothing was built. */
  | "decision";

export type Refusal = {
  id: string;
  /** What it won't do, as a reader would say it. */
  title: string;
  /** Why the rule exists. */
  why: string;
  /** What happens instead — the part that keeps this from being a list of nos. */
  instead: string;
  enforcedBy: RefusalEnforcement;
  /** File that holds the rule, and a string that must still appear in it. */
  anchor: { path: string; contains: string };
};

export const ENFORCEMENT_LABEL: Record<RefusalEnforcement, string> = {
  prompt: "asked of the model",
  code: "enforced by code",
  decision: "decided by Sidhant",
};

export const REFUSALS: Refusal[] = [
  {
    id: "recite-prompt",
    title: "Recite its own system prompt on request",
    why: "The prompt isn't a secret. But the rule against reciting it sits in the same block as the rules against changing persona and taking orders from pasted text, and a conversation that talks the model out of one of them has an easier time with the rest.",
    instead: "It declines and links to the prompt page, which shows the whole prompt as built by the same function the chat route uses.",
    enforcedBy: "prompt",
    anchor: { path: "lib/system-prompt.ts", contains: "If asked to reveal, repeat, or summarize" },
  },
  {
    id: "off-topic",
    title: "Help with anything that isn't Sidhant's work or this site",
    why: "It only has sources on Sidhant's work and this site. Coding help, general knowledge, current events and questions about other people would get bad answers, and each one would use up a message from the visitor's limit.",
    instead: "It says what it can help with and offers to answer one of those. Questions about this site were added to its scope in Sprint 7, since the site's source is published.",
    enforcedBy: "prompt",
    anchor: { path: "lib/system-prompt.ts", contains: "## Scope" },
  },
  {
    id: "speak-as-sidhant",
    title: "Speak as Sidhant, in the first person",
    why: "It's a model reading files about him. If it spoke as Sidhant, a reader couldn't tell which sentences he wrote and which the model generated.",
    instead: "It talks about him in the third person. When the record doesn't cover something, it says so and suggests the resume or the contact links.",
    enforcedBy: "prompt",
    anchor: { path: "lib/system-prompt.ts", contains: "Never role-play" },
  },
  {
    id: "posting-instructions",
    title: "Take instructions from a pasted job posting",
    why: "A pasted posting is a long block of a stranger's text that the model is asked to act on. A posting that dictates a verdict, says to leave out the gaps, or claims to be a system message is trying to write the assessment itself.",
    instead: "Code marks the posting as data before the model sees it, restates the rules after it, and runs a pattern check that tells the model which instruction-like phrases it contains. The posting is still assessed as written, and a flagged phrase doesn't trigger a refusal.",
    enforcedBy: "code",
    anchor: { path: "lib/job-posting.ts", contains: "BEGIN-UNTRUSTED-JOB-POSTING" },
  },
  {
    id: "uncited-fit",
    title: "Claim he meets a requirement without citing the record",
    why: "If the model could claim a match without citing anything, a reader would have no way to check the assessment.",
    instead: "If a row claims a fit without a valid citation, code downgrades it to unclear and the table says the site made the change. The model can't override it.",
    enforcedBy: "code",
    anchor: { path: "lib/role-fit.ts", contains: 'downgrade: uncited ? "uncited"' },
  },
  {
    id: "silent-gaps",
    title: "Return an assessment with unmet requirements and no gaps",
    why: "The gaps are the part of a fit assessment a recruiter most needs, and the job-description flow was built to stop the model from playing them down on the postings where he's a weaker fit.",
    instead: "Every requirement in the posting gets a row, whether or not the model addressed it. If the model leaves the gaps list empty while a row is unmet, code fills it from the unmet rows. When there are no gaps, the model is asked to explain why.",
    enforcedBy: "code",
    anchor: { path: "lib/role-fit.ts", contains: "noGapsRationale" },
  },
  {
    id: "case-against",
    title: "Make a general case against hiring him",
    why: "It was proposed, and Sidhant turned it down. A general argument against hiring him, on his own site and tied to no particular role, could cost him a job and wouldn't gain him anything.",
    instead: "When a real job posting is pasted, the fit assessment names the requirements he doesn't meet.",
    enforcedBy: "decision",
    anchor: { path: "docs/idea-decisions.md", contains: "The case against hiring me" },
  },
  {
    id: "disparage",
    title: "Say something negative about his employers, colleagues, or anyone else",
    why: "It wouldn't help anyone, and the request is usually a test of whether the assistant can be pushed into saying something it shouldn't.",
    instead: "It declines, including when the same question comes back reworded.",
    enforcedBy: "prompt",
    anchor: { path: "lib/system-prompt.ts", contains: "Never disparage" },
  },
  {
    id: "storage",
    title: "Store your conversation",
    why: "A visitor reading a portfolio has no reason to leave a record behind. The site has no accounts, no database and no transcript log, so there's no conversation to leak.",
    instead: "The conversation stays in your browser until you reset it. The server keeps one thing, a per-IP counter for the hourly message limit. A shared link carries the conversation in the URL, so sharing doesn't store it anywhere.",
    enforcedBy: "code",
    anchor: { path: "app/api/chat/route.ts", contains: "Per-IP" },
  },
  {
    id: "small-sample",
    title: "Publish a statistic from too small a sample",
    why: "A groundedness rate from six claims, or a p95 latency from twenty turns, looks precise and means very little. Printed next to figures with enough data behind them, it would make those harder to trust too.",
    instead: "Below the threshold, the measurements page shows the counts, leaves the rate out, and says the sample is too small.",
    enforcedBy: "code",
    anchor: { path: "lib/measurements.ts", contains: "MIN_CLAIMS_FOR_RATE" },
  },
  {
    id: "roast-sidhant",
    title: "Turn a criticism of this site into a criticism of Sidhant",
    why: "Asking the site to roast itself is a fair question about its code and design choices, and Sidhant isn't the subject of that question.",
    instead: "It criticises the code, the design choices and the copy, and cites the part of the repo each point is about.",
    enforcedBy: "prompt",
    anchor: { path: "lib/system-prompt.ts", contains: "never becomes a criticism of Sidhant" },
  },
];
