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
// Read as an experience timeline, newest first, for the role families he is
// applying to (RevOps, sales ops and delivery ops). `now` is the scope of the
// current job, in the master resume's summary words; `built` and `shipped` are
// its two tools with numbers; `inherited` is the other half of the one-line
// story (he keeps other people's systems alive); `before that` is the
// workforce role. The A Darle 20 row carries no number because its card below
// does. Every figure is the master resume's (2026-10-26).
export const RECRUITER_TLDR: TldrRow[] = [
  {
    label: "now",
    value:
      "I own the reporting and tooling for Nokia's 7-region, $10B+ pipeline sales organization: incentives, quarter-end close and weekly operating review.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "built",
    value:
      "The weekly operating review tool regional sales ops teams use to compile the Chief Customer Officer's weekly report, shipped in two weeks.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "shipped",
    value:
      "The self-serve Power App behind quarter-end executive reporting for 80+ stakeholders across 7 regions, replacing an error-prone, full-day manual consolidation.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "inherited",
    value:
      "The Power App and automations North America runs all its reviews on (30 core users), and the sales incentive calculations for 900+ staff. I extended the first and cut steps and manual checks from the second.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "before that",
    value:
      "Workforce management at Nokia, Oct 2021 – Jun 2024: I ran the monthly headcount forecast for a 3,000–4,000-person org and led an analysis that identified $1.2M in real-estate cost savings.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "also",
    value:
      "Co-founder and CTO of A Darle 20 (part-time), a marketplace I built as its sole developer.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "looking for",
    value: "A RevOps, sales operations or delivery operations role.",
    source: "content/knowledge/faq.md",
  },
  {
    label: "where",
    value: "Toronto, ON.",
    source: "content/knowledge/faq.md",
  },
];

export const TLDR_FOOTER = "The resume has the rest.";

// The H1: the one-line story from the resume decisions log (2026-10-25), "an
// ops person whose edge is building". It names the work and its scale; the
// `inherited` row below carries the other half ("and I keep alive the ones
// other people built"). Voice rather than a checkable claim, so it isn't a
// TldrRow, but its one figure is the resume's.
export const HERO = "I build and run the tools a 7-region sales organization reports on.";

// The hero subline: the `looking for` row as a sentence a visitor doesn't have
// to scroll for. Toronto is on the role line above the H1, so it isn't said
// twice. Same claims and source file, checked like the rows. Also the og:image's
// last line.
export const POSITIONING: TldrRow = {
  label: "positioning",
  value: "Looking for a RevOps, sales operations or delivery operations role.",
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
    title: "Reporting and tooling at Nokia",
    stat: "150+",
    statLabel: "monthly users on the Salesforce CRM Analytics dashboards I delivered for exec reviews",
    href: "/projects/nokia",
    source: "content/knowledge/projects-nokia.md",
  },
  {
    slug: "adarle20",
    title: "A Darle 20",
    stat: "2,100+",
    statLabel: "users, with 110+ hosts and 3,600+ session reservations from 1,000+ players",
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
  "What does he build and run at Nokia?",
  FIT_QUESTION,
];
