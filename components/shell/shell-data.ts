import { FIT_QUESTION } from "@/content/recruiter";
import { JD_PREFIX } from "@/lib/job-posting";
import { ROAST_REQUEST, SITE_REQUEST } from "@/lib/site-question";
import { EMAIL, GITHUB_URL, LINKEDIN_URL } from "@/lib/site";
import { PANELS, SLASH_PANELS, type PanelView, type PlainPanelKind } from "./panels";

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
// Sidhant's rewrite; this array follows that file. Since wave 2 it is no
// longer a panel of its own in the index — it argued for a chat-first site,
// which the front-door policy reversed — and is read as one section of the
// colophon (the page and the panel), where the site explains itself.
export const WHY_CHATBOT_HEADING = "Why there's a chat on a portfolio";

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
  view?: PanelView;
};

// The header nav — Resume, Projects, and a Contact button beside them. Since
// wave 2 it is permanent: the front-door pass swapped it for telemetry once a
// conversation started, which took the resume off the header at the moment a
// visitor had shown interest. Real routes on purpose: they work before
// hydration. "Colophon" left the header in the same pass; it is the first
// entry under "How this site works" in the index, and the composer's fine
// print links to it.
export const HEADER_NAV = [
  { label: "Resume", href: "/resume" },
  { label: "Projects", href: "/projects" },
] as const;

// The index behind ☰, regrouped in wave 2. It was one flat list of twelve, in
// which the system prompt sat at the same level as the resume and a recruiter
// had to read all of it to find the two things they came for. Now: the work
// first, then how to reach him (rendered by the shell, because it carries the
// copyable address), then everything about how the site itself works — the
// machinery, one heading down rather than gone.
export type RailGroup = { label: string; items: RailItem[] };

export const RAIL_WORK: RailGroup = {
  label: "Work",
  items: [
    { label: "Resume", href: "/resume", view: { kind: "resume" } },
    { label: "Resume PDF", href: "/resume.pdf", external: true },
    { label: "Nokia", href: "/projects/nokia", view: { kind: "project", slug: "nokia" } },
    {
      label: "A Darle 20",
      href: "/projects/adarle20",
      view: { kind: "project", slug: "adarle20" },
    },
    { label: "Dell", href: "/projects/dell-ml", view: { kind: "project", slug: "dell-ml" } },
    { label: "Paste a job description", view: { kind: "jd" } },
  ],
};

export const RAIL_CONTACT_LABEL = "Contact";

export const RAIL_HOW: RailGroup = {
  label: "How this site works",
  items: [
    { label: "How it's built", href: "/colophon", view: { kind: "colophon" } },
    // Sprint 7's two published documents (#7, #10). Both have a real page and
    // open in the panel on a plain click, like everything else in this index.
    { label: "The instructions", href: "/prompt", view: { kind: "prompt" } },
    { label: "What it won't do", href: "/refusals", view: { kind: "refusals" } },
    { label: "Measurements", href: "/measurements" },
    // The header's receipt is the desktop way in; below lg it is hidden, so
    // this is the route to the instruments — and the model picker — there.
    { label: "Instruments", view: { kind: "instruments" } },
  ],
};

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

// docs/site-copy.md → "Job-description fit". Marked DRAFT there.
export const JD_COPY = {
  // The panel's title bar shows the same words, so the heading is read out of
  // the registry rather than kept twice.
  heading: PANELS.jd.title,
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

/**
 * Said over a table that is an excerpt — the short fit link carries the
 * scorecard's rows, not all of them (lib/transcript.ts → fitSnapshot). The
 * counts above it still count every row, so without this line three rows
 * under "3 met · 11 partial" would read as a complete assessment.
 */
export function fitExcerptNote(shown: number, total: number): string {
  return shown > 0
    ? `Showing ${shown} of ${total} requirements: the strongest cited ones. The counts cover all ${total}, and every gap is listed below.`
    : `This link carries the counts for all ${total} requirements and every gap, but none of the rows.`;
}

// Nokia first, as everywhere since wave 2.
export const PROJECT_LINKS = [
  { label: "Nokia", href: "/projects/nokia" },
  { label: "A Darle 20", href: "/projects/adarle20" },
  { label: "Dell", href: "/projects/dell-ml" },
];

export const SOCIAL_LINKS = [
  { label: "GitHub", href: GITHUB_URL },
  { label: "LinkedIn", href: LINKEDIN_URL },
  { label: "Email", href: `mailto:${EMAIL}` },
];

export type SlashCommand = {
  name: string;
  hint: string;
  /** 'panel' opens the context panel locally; 'send' dispatches a chat message. */
  kind: "panel" | "send";
  /**
   * For kind==='panel': which panel view to open. Not typed as a string any
   * more — it is a kind from the registry, so the typo that used to open
   * nothing and say nothing is now a compile error.
   */
  panel?: PlainPanelKind;
  /** For kind==='send': the message text (verbatim from docs/site-copy.md). */
  message?: string;
};

// Slash-command labels are UI affordances, not site copy. The one command that
// sends a message reuses a suggested question verbatim from site-copy.md.
//
// The nine panel commands are no longer typed out here. Each one is the `slash`
// field of the panel it opens, so a command and its destination are the same
// fact — see panels.ts. The three that send a message have no panel and stay.
//
// Extended in Sprint 5 (#13). The decisions doc lists `/jd`, `/model`,
// `/budget`, `/sources` and `/pdf`; four of the five are here, because four of
// the five now have somewhere to point. `/model` is not: it needs an argument
// ("/model gpt-5-mini") and this registry has no parser, so it would either be
// a fifth panel or a lie. The header select still does that job.
export const SLASH_COMMANDS: SlashCommand[] = [
  ...SLASH_PANELS.map(
    ({ name, hint, panel }): SlashCommand => ({ name, hint, kind: "panel", panel }),
  ),
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
    // Literally the same string as the third suggested chip — see
    // content/recruiter.ts. One question, two surfaces.
    message: FIT_QUESTION,
  },
];
