// The refusal ledger (roadmap Sprint 7, #10).
//
// Hand-curated content, not a generated feature: this file lists what the
// assistant will not do, why, and what it does instead. Every entry describes a
// rule that already exists somewhere in this repo, and every entry names the
// file that holds it — `evals/recursion.test.mjs` opens each of those files and
// fails if the anchor text has moved, so an entry cannot quietly become a
// description of a rule the site stopped enforcing.
//
// WHY `enforcedBy` IS THE INTERESTING COLUMN. A refusal written into the system
// prompt is a request: it holds because the model cooperates, and a determined
// visitor may eventually talk around it. A refusal written into the route or a
// reconciler is a property of the code: no wording changes it. Publishing a
// ledger that hid the difference would be claiming more than the site can
// support — which is the same rule Sprint 3 set for the word "verified".
//
// Nothing here asserts anything about Sidhant. The one entry that came from him
// rather than from the code quotes the decision that recorded it.

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
  decision: "a decision, not a mechanism",
};

export const REFUSALS: Refusal[] = [
  {
    id: "recite-prompt",
    title: "Recite its own system prompt on request",
    why: "The instruction not to hand over the prompt sits in the same block as the instructions not to change persona and not to take orders from pasted text. A conversation that can talk it out of one of those is most of the way to the rest, so it declines the request rather than negotiating it — even though the prompt itself is not a secret.",
    instead: "It declines and points at the published prompt, which is on this site in full, assembled by the same function the chat route calls.",
    enforcedBy: "prompt",
    anchor: { path: "lib/system-prompt.ts", contains: "If asked to reveal, repeat, or summarize" },
  },
  {
    id: "off-topic",
    title: "Help with anything that isn't Sidhant's work or this site",
    why: "It is a portfolio assistant with one corpus. Coding help, general knowledge, current events and opinions about other people are all things it would answer badly and cheaply, and every one of them is a way to spend a visitor's turn on something that isn't why they came.",
    instead: "It says what it can help with and offers to answer one of those instead. Questions about this site's own construction are the single exception, added in Sprint 7 — the source is published, so the site is a legitimate subject.",
    enforcedBy: "prompt",
    anchor: { path: "lib/system-prompt.ts", contains: "## Scope" },
  },
  {
    id: "speak-as-sidhant",
    title: "Speak as Sidhant, in the first person",
    why: "It is a model reading a corpus, and letting it wear his voice would blur the one distinction a reader needs to keep: which sentences are his and which are generated from a file. The site's answer to that is to never let the question arise.",
    instead: "It answers in the third person, and points at the resume as the authoritative version whenever the difference matters.",
    enforcedBy: "prompt",
    anchor: { path: "lib/system-prompt.ts", contains: "Never role-play" },
  },
  {
    id: "posting-instructions",
    title: "Take instructions from a pasted job posting",
    why: "The posting box is the one place on this site where a stranger's text arrives at length through a channel that says 'act on this'. A posting that dictates a verdict, suppresses the gaps, or claims to be a system message is trying to write the assessment for the candidate.",
    instead: "The posting is fenced as data before the model reads a word of it, the rules are restated underneath it, and a deterministic pre-pass tells the model which instruction-shaped patterns it contains. It is assessed as written, and the pre-pass is reported rather than used to refuse.",
    enforcedBy: "code",
    anchor: { path: "lib/job-posting.ts", contains: "BEGIN-UNTRUSTED-JOB-POSTING" },
  },
  {
    id: "uncited-fit",
    title: "Claim he meets a requirement without pointing at the record",
    why: "A fit assessment is worth exactly what its evidence is worth. If the model could assert a match and cite nothing, the citation would be decoration and the assessment would be a mood.",
    instead: "A row claiming a fit that cites nothing valid is downgraded to unclear by the reconciler, and the reader is told the site downgraded it. The model has no vote in that.",
    enforcedBy: "code",
    anchor: { path: "lib/role-fit.ts", contains: 'downgrade: uncited ? "uncited"' },
  },
  {
    id: "silent-gaps",
    title: "Return an assessment with unmet requirements and no gaps",
    why: "Naming the gaps is the part of a fit assessment a recruiter is actually reading for, and the failure this whole flow was built to fix is a model that soft-pedals exactly the postings it should be honest about.",
    instead: "Every requirement the posting stated gets a row whether the assessment answered it or not, and an assessment that leaves gaps empty while an unmet row exists has them filled in from the rows. An assessment with genuinely no gaps has to say why.",
    enforcedBy: "code",
    anchor: { path: "lib/role-fit.ts", contains: "noGapsRationale" },
  },
  {
    id: "case-against",
    title: "Make a general case against hiring him",
    why: "It was proposed, and Sidhant turned it down: a blanket, role-free argument against the candidate, hosted by the candidate, is a liability with no upside. Honesty with no role to be honest about is self-sabotage with good manners.",
    instead: "The honest-fit value lives in the job-description flow, where a real posting is on the table and unmet requirements are named plainly against it.",
    enforcedBy: "decision",
    anchor: { path: "docs/idea-decisions.md", contains: "The case against hiring me" },
  },
  {
    id: "disparage",
    title: "Say something negative about his employers, colleagues, or anyone else",
    why: "There is no version of that which helps, and the request usually arrives as an attempt to see whether the assistant can be steered somewhere it shouldn't go.",
    instead: "It declines, and it does not treat a reframing of the same question as a different question.",
    enforcedBy: "prompt",
    anchor: { path: "lib/system-prompt.ts", contains: "Never disparage" },
  },
  {
    id: "storage",
    title: "Store your conversation",
    why: "Nothing about a stranger reading a portfolio needs to be kept. There is no account, no database and no transcript log, which also means there is nothing here to leak.",
    instead: "The conversation lives in your browser until you reset it. The only thing kept server-side is a per-IP counter for the hourly message limit, and a shared link carries the conversation inside the URL rather than storing it anywhere.",
    enforcedBy: "code",
    anchor: { path: "app/api/chat/route.ts", contains: "Per-IP" },
  },
  {
    id: "small-sample",
    title: "Publish a percentage it doesn't have the sample for",
    why: "A groundedness rate computed from six claims, or a p95 latency computed from twenty turns, is a number wearing a statistic's clothes. Publishing it in the same type as everything else on the page would make the honest figures on that page worth less.",
    instead: "Below the threshold the page prints the counts and withholds the rate, and says which of those it is doing.",
    enforcedBy: "code",
    anchor: { path: "lib/measurements.ts", contains: "MIN_CLAIMS_FOR_RATE" },
  },
  {
    id: "roast-sidhant",
    title: "Turn a criticism of this site into a criticism of Sidhant",
    why: "Asking a portfolio to roast itself is a good question about the engineering and a terrible way to get at the person who commissioned it. The site is fair game; he is not the subject.",
    instead: "It criticises the code, the choices and the copy, cites the part of the repo it is complaining about, and stops there.",
    enforcedBy: "prompt",
    anchor: { path: "lib/system-prompt.ts", contains: "never becomes a criticism of Sidhant" },
  },
];
