import { JD_PREFIX } from "@/lib/job-posting";
import { ROAST_REQUEST, SITE_REQUEST } from "@/lib/site-question";

// Navigation and copy for the app shell.
//
// Resume content is NOT here — it comes from lib/chunks.generated.ts, built
// from content/knowledge/*.md by scripts/build-knowledge.mjs. Those are the
// same chunks the model reads, under the same ids it cites, so the evidence a
// visitor sees beside an answer can't drift from the evidence the answer was
// built from. Edit the markdown, not a copy of it.

// Maps a project slug from the showProject tool onto the chunk id (from
// lib/chunks.generated.ts) that evidences it. Dell has a resume entry but the
// case study carries more than the one line there, so it routes to the project
// view instead.
//
// Ids are `<source>:<slug>` since Sprint 3 — the corpus is one id space now,
// not just the resume's sections, so a bare `nokia` would be ambiguous between
// the resume block and the case-study file.
export const SLUG_TO_RESUME: Record<string, string> = {
  adarle20: "resume:a-darle-20",
  nokia: "resume:nokia",
};

// docs/site-copy.md → "Why this site is a chatbot". Marked DRAFT there pending
// Sidhant's rewrite; this array follows that file.
export const WHY_CHATBOT = [
  "Most software is turning into a conversation. I don't build my own PostHog dashboards anymore — I describe what I want and the product's assistant builds it, because it knows the platform better than I do. That pattern is going to take over a lot of interfaces, and I don't see why a portfolio would be the exception.",
  "A portfolio is a list standing in for a conversation you can't have. The better version is talking to me — about what I built, why, what it took, whether any of it maps to what you need. You can't do that at eleven at night while you're going through a stack of candidates. You can do this.",
  "So come with the specific question. How the payments work. What the Nokia rollout actually involved. What I'd do in the first ninety days of the role you're hiring for. Skip everything you don't care about.",
  "Every answer is built from the same source files as the resume, and it will show you which one, so you can open the long version whenever something is worth more than a paragraph.",
];

// A rail item with a `view` opens in the context panel and pushes `href` into
// the address bar; the href is still a real route, so cmd-click, "open in new
// tab", and crawlers all get the standalone page. Items with only an href
// always navigate.
export type RailItem = {
  label: string;
  href?: string;
  external?: boolean;
  view?: PanelViewSpec;
};

// Structural mirror of PanelView's opening cases, kept here so the data module
// doesn't import from the conversation hook.
export type PanelViewSpec =
  | { kind: "resume" }
  | { kind: "why" }
  | { kind: "contact" }
  | { kind: "colophon" }
  | { kind: "jd" }
  | { kind: "instruments" }
  | { kind: "prompt" }
  | { kind: "refusals" }
  | { kind: "project"; slug: "adarle20" | "nokia" | "dell-ml" };

export const RAIL_ITEMS: RailItem[] = [
  { label: "Resume", href: "/resume", view: { kind: "resume" } },
  { label: "Resume PDF", href: "/resume.pdf", external: true },
  {
    label: "A Darle 20",
    href: "/projects/adarle20",
    view: { kind: "project", slug: "adarle20" },
  },
  { label: "Nokia", href: "/projects/nokia", view: { kind: "project", slug: "nokia" } },
  { label: "Dell", href: "/projects/dell-ml", view: { kind: "project", slug: "dell-ml" } },
  { label: "Colophon", href: "/colophon", view: { kind: "colophon" } },
  // Sprint 7's two published documents (#7, #10). Both have a real page and
  // open in the panel on a plain click, like everything else in this rail.
  { label: "The instructions", href: "/prompt", view: { kind: "prompt" } },
  { label: "What it won't do", href: "/refusals", view: { kind: "refusals" } },
  { label: "Why this site is a chatbot", view: { kind: "why" } },
  { label: "Paste a job description", view: { kind: "jd" } },
  // The header readouts are the desktop way in. Below md they're hidden, so the
  // rail is the only route to the instruments — see the note in instruments.tsx.
  { label: "Instruments", view: { kind: "instruments" } },
  { label: "Contact", view: { kind: "contact" } },
];

// Idle mode (#14). Build-time constants, deliberately: an idle tab must cost
// nothing, so these can never become a generated line.
//
// Every one of them is a claim about the SITE, not about Sidhant, and each is
// checkable in this repo — the sliding hour is in route.ts, and the
// byte-identical cached prompt is the base `buildSystemPrompt()` returns on
// every turn that didn't ask about the site (Sprint 7, #8). Nothing
// here asserts anything about his experience, which is what keeps this list on
// the right side of the copy rule. Logged in docs/copy-ledger.md.
export const IDLE_LINES = [
  "Still here. These lines ship with the page — an idle tab costs nothing and calls nothing.",
  "The knowledge base rides inside the prompt, byte for byte, so the cache hits on every turn after the first.",
  "No tokens are moving. The needle is at rest.",
  "The message budget refills on a sliding hour, so there's rarely anything to wait for.",
  "Most of the rail has a real page underneath it. Cmd-click and see.",
  "Ask the question you'd actually ask on a call.",
];

// Recruiter TL;DR (#25, Track B). docs/site-copy.md → "Homepage → Recruiter
// TL;DR". Marked DRAFT there pending Sidhant's review, and logged in
// docs/copy-ledger.md.
//
// This is the one block on the site that makes claims about Sidhant rather than
// about the site, so the rule it lives under is stricter than the rest of this
// file: EVERY value below is lifted from content/knowledge/ or the resume, and
// the `source` field names the file it came from. It is not decoration — it is
// what evals/track-b.test.mjs checks the corpus still contains. A row whose
// fact the corpus stops carrying should fail the suite, not quietly become
// untrue on the homepage.
//
// Scan-shaped rather than prose on purpose: the reader this exists for has not
// started reading yet. Six seconds, per decisions #25.
export type TldrRow = {
  /** Short mono label, lowercase, like the status strip's readouts. */
  label: string;
  value: string;
  /** The corpus file this row's facts come from. */
  source: string;
};

export const TLDR_LABEL = "tl;dr";

export const RECRUITER_TLDR: TldrRow[] = [
  {
    label: "now",
    value:
      "Sales operations specialist at Nokia, in Toronto. Co-founder and CTO of A Darle 20.",
    source: "content/knowledge/bio.md",
  },
  {
    label: "shipped",
    value:
      "A Darle 20 — a two-sided marketplace, architected and shipped solo. 1,400+ registered users, 127 hosts and 2,100+ bookings in its first four months.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "before that",
    value:
      "At Nokia: a self-serve Power App used by 80+ stakeholders across seven regions, and a Salesforce Analytics to Power BI migration for 150+ users.",
    source: "content/knowledge/projects-nokia.md",
  },
  {
    label: "how he builds",
    value:
      "An AI-agent-heavy workflow in Claude Code — agents write most of the code, he keeps architecture, code review and release.",
    source: "content/knowledge/projects-adarle20.md",
  },
  {
    label: "looking for",
    value: "A RevOps / GTM systems role at an AI-forward company.",
    source: "content/knowledge/faq.md",
  },
  {
    label: "where",
    value: "Toronto, ON. Canadian citizen, no visa sponsorship needed.",
    source: "content/knowledge/faq.md",
  },
];

export const TLDR_FOOTER = "The resume has the rest, and so does the box below.";

// docs/site-copy.md → "Job-description fit". Marked DRAFT there.
export const JD_COPY = {
  heading: "Paste a job description",
  body: "Paste the posting and I'll map my experience onto it — including the parts I don't match.",
  placeholder: "Paste the job description here",
  submit: "Check the fit",
  // Lives in lib/job-posting.ts because the server reads it too — it's the
  // strongest signal that a turn is a posting, and the route forces the
  // roleFit tool call on those turns.
  prefix: JD_PREFIX,
};

// Labels over the role-fit assessment, shared by the context panel, the print
// document and the scorecard export (Sprint 5) so the same field can't be
// called three things in three artifacts. Logged in docs/copy-ledger.md.
//
// `notAScore` is load-bearing rather than decorative: decisions §3 attaches a
// rendering constraint to this component — four crisp tags look more precise
// than the assessment under them — and this sentence is how that constraint is
// met. It travels with the table into print and into the scorecard for the same
// reason the gaps do.
export const FIT_LABELS = {
  gaps: "What he doesn't have",
  noGaps: "No unmet requirements — why",
  counts: "Coverage",
  evidence: "Strongest evidence",
  notAScore:
    "Each row is a judgment against the record, not a score, and the four tags don't add up to one. A row claiming a fit has to name the part of the record it stands on; where it didn't, the site downgraded it rather than the model.",
};

export const PROJECT_LINKS = [
  { label: "A Darle 20", href: "/projects/adarle20" },
  { label: "Nokia", href: "/projects/nokia" },
  { label: "Dell", href: "/projects/dell-ml" },
];

export const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com/sidhantmathur" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/sidhantmathur" },
  { label: "Email", href: "mailto:hello@sidhantmathur.com" },
];

export type SlashCommand = {
  name: string;
  hint: string;
  /** 'panel' opens the context panel locally; 'send' dispatches a chat message. */
  kind: "panel" | "send";
  /**
   * For kind==='panel': which panel view to open. Every name here has to be a
   * `PanelView` kind in use-conversation.ts — a typo would open nothing, and
   * silently. evals/export.test.mjs asserts the two lists agree.
   */
  panel?:
    | "resume"
    | "projects"
    | "contact"
    | "jd"
    | "instruments"
    | "export"
    | "corpus"
    | "prompt"
    | "refusals";
  /** For kind==='send': the message text (verbatim from docs/site-copy.md). */
  message?: string;
};

// Slash-command labels are UI affordances, not site copy. The one command that
// sends a message reuses a suggested question verbatim from site-copy.md.
//
// Extended in Sprint 5 (#13). The decisions doc lists `/jd`, `/model`,
// `/budget`, `/sources` and `/pdf`; four of the five are here, because four of
// the five now have somewhere to point. `/model` is not: it needs an argument
// ("/model gpt-5-mini") and this registry has no parser, so it would either be
// a fifth panel or a lie. The header select still does that job.
export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "/resume", hint: "Open the resume in the panel", kind: "panel", panel: "resume" },
  { name: "/projects", hint: "List the three projects", kind: "panel", panel: "projects" },
  { name: "/contact", hint: "Show contact links", kind: "panel", panel: "contact" },
  { name: "/jd", hint: "Paste a job description", kind: "panel", panel: "jd" },
  { name: "/budget", hint: "Turns, tokens and what they cost", kind: "panel", panel: "instruments" },
  { name: "/sources", hint: "Every source the answers are built from", kind: "panel", panel: "corpus" },
  { name: "/pdf", hint: "Export — markdown, print, link", kind: "panel", panel: "export" },
  { name: "/prompt", hint: "Read the instructions it was given", kind: "panel", panel: "prompt" },
  { name: "/refusals", hint: "What it won't do, and why", kind: "panel", panel: "refusals" },
  {
    name: "/site",
    hint: "How this site is built",
    kind: "send",
    message: SITE_REQUEST,
  },
  {
    name: "/roast",
    hint: "Ask it what's wrong with this site",
    kind: "send",
    message: ROAST_REQUEST,
  },
  {
    name: "/fit",
    hint: "Ask about role fit",
    kind: "send",
    // Kept verbatim-identical to one of the suggested chips (#26 swapped both
    // together) so the command and the chip can't become two questions.
    message: "Is he a fit for a RevOps role at an AI-forward company?",
  },
];
