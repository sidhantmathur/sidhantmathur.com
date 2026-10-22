// Recruiter-facing copy for the front door: the tl;dr (#25), the role and
// positioning lines, the case-study cards and the suggested questions (#26).
// All of it is drafted copy, logged in docs/copy-ledger.md.
//
// This module imports nothing, so evals/track-b.test.mjs can read the strings
// as values and run the site's own citation checker (lib/verify.ts) over each
// fact-carrying one against the corpus file its `source` names. Those values
// make claims about Sidhant, so none is written fresh: each is lifted from
// content/knowledge/ or the resume.

export type TldrRow = {
  /** Short mono label, lowercase, like the status strip's readouts. */
  label: string;
  value: string;
  /** The corpus file this row's facts come from. Checked by the suite. */
  source: string;
};

export const TLDR_LABEL = "summary";

// Scan-shaped rather than prose: the reader this is for hasn't started reading
// yet (six seconds, per decisions #25).
//
// First person, like the H1 above it and the case studies behind it: the
// front door is Sidhant talking, and the chat is the only voice that calls
// him "he".
//
// Read as an experience timeline, newest first, for the two role families he
// is applying to (RevOps and delivery ops, 2026-10-22). `now` is the job and
// what he owns in it; `shipped` is its outcome in operating terms; `before
// that` is the workforce role, the delivery-ops evidence (headcount
// forecasting at scale, utilization data), which used to live only on the
// case study. The A Darle 20 row carries no number because its card below
// does. Every figure is the resume's.
export const RECRUITER_TLDR: TldrRow[] = [
  {
    label: "now",
    value:
      "Sales operations at Nokia since Jun 2024. I build and own reporting tools for global sales and finance, from requirements to rollout and support.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "shipped",
    value:
      "A self-serve Power App for 80+ stakeholders in 7 regions, replacing manual quarter-end collection that took a finance analyst's entire workday, every day of close.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "before that",
    value:
      "Workforce management at Nokia, Oct 2022 – Jun 2024: headcount reporting and forecasting for a 3,000–4,000-person organization. I identified $1.2M in real-estate cost savings in lab and facility utilization data.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "also",
    value:
      "Co-founder and CTO of A Darle 20, a live two-sided marketplace I architected and shipped solo, payments, refunds and funnel instrumentation included.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "how I build",
    value:
      "At A Darle 20, AI agents in Claude Code write most of the code. I own architecture, code review and release.",
    source: "content/knowledge/projects-adarle20.md",
  },
  {
    label: "looking for",
    value: "A revenue operations or delivery operations role at an AI-forward company.",
    source: "content/knowledge/faq.md",
  },
  {
    label: "where",
    value: "Toronto, ON. Canadian citizen, no visa sponsorship needed.",
    source: "content/knowledge/faq.md",
  },
];

export const TLDR_FOOTER = "The resume has the rest.";

// The H1. Sidhant wrote the one it replaced ("I learn what the problem
// needs, then I build the thing.") — a motto, where a screener's first five
// seconds need the job. This one names it: he builds the systems, rolls them
// out, and the people on them are sales and finance teams. "Roll out" carries
// the delivery half without a label. Gauntlet pass, 2026-10-22; logged in the
// copy ledger. Voice, not a checkable claim, so it isn't a TldrRow — the rows
// below it carry the evidence.
export const HERO = "I build and roll out the tools sales and finance teams run on.";

// The hero subline: the `looking for` and `where` rows fused into one sentence
// a visitor doesn't have to scroll for. Toronto is on the role line above the
// H1, so it isn't said twice. Same claims and source file, checked like the
// rows.
export const POSITIONING: TldrRow = {
  label: "positioning",
  value:
    "Looking for a revenue operations or delivery operations role at an AI-forward company. Canadian citizen, no visa sponsorship needed.",
  source: "content/knowledge/faq.md",
};

// The line under his name, above the H1: the job title a recruiter searches
// for, the employer, and the city. The H1 says what the job is for, so this
// line only has to say what it's called. Also read by the og:image.
export const ROLE_LINE: TldrRow = {
  label: "role",
  value: "Sales operations specialist at Nokia · Toronto, ON",
  source: "content/knowledge/resume.md",
};

export type CaseCard = {
  slug: "nokia" | "adarle20";
  /** The case study's own title, as content/projects.ts writes it. */
  title: string;
  stat: string;
  statLabel: string;
  href: string;
  source: string;
};

export const CASE_CARDS: CaseCard[] = [
  {
    slug: "nokia",
    title: "Reporting tools at Nokia",
    stat: "150+",
    statLabel: "users on the sales reporting I moved from Salesforce Analytics to Power BI",
    href: "/projects/nokia",
    source: "content/knowledge/projects-nokia.md",
  },
  {
    slug: "adarle20",
    title: "A Darle 20",
    stat: "2,100+",
    statLabel: "bookings in the four months after launch",
    href: "/projects/adarle20",
    source: "content/knowledge/projects-adarle20.md",
  },
];

export const CASE_CARDS_LABEL = "case studies";

// What the tl;dr block under the hero renders: the rows the subline doesn't
// already carry. Derived, so the full list above stays the one checked set.
export const HERO_TLDR = RECRUITER_TLDR.filter(
  (r) => r.label !== "looking for" && r.label !== "where",
);

/** The chip the `/fit` slash command sends. One string, two surfaces. */
export const FIT_QUESTION = "Is he a fit for a RevOps role?";

// #26: the first things a recruiter asks. They replace the old chips rather
// than adding a recruiter mode.
//
// Three, so the row sits on one line above the composer at laptop widths
// (Sidhant, 2026-10-20). "What has he shipped end to end?" was the one cut:
// the Nokia chip asks the same thing about the work that matters most. The
// longest chip goes last, so a narrow window wraps it alone.
//
// None may trip `looksLikeJobPosting` or `looksLikeSiteQuestion`: a suggested
// question that forces a roleFit call or loads the repo corpus turns the
// site's own affordance into its worst path. Asserted in
// evals/track-b.test.mjs.
export const SUGGESTED_QUESTIONS = [
  "Give me the short version",
  "What did he own end to end at Nokia?",
  FIT_QUESTION,
];
