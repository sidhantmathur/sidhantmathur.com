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
// Nokia first and labelled as current: for the RevOps and sales-ops roles he
// is applying to, Nokia is the proof and A Darle 20 the differentiator. The
// Nokia rows carry outcomes rather than a job title alone. Every figure is the
// resume's.
export const RECRUITER_TLDR: TldrRow[] = [
  {
    label: "now",
    value:
      "Sales operations specialist at Nokia since Jun 2024, building internal tools and automation for global sales and finance teams.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "shipped",
    value:
      "A self-serve Power App used by 80+ stakeholders across 7 regions, replacing a manual process that took one finance analyst's entire workday, every day of quarter-end close. He also migrated all sales reporting from Salesforce Analytics to Power BI for 150+ users.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "also",
    value:
      "Co-founder and CTO of A Darle 20, a two-sided marketplace he architected and shipped solo: 1,400+ registered users, 127 hosts and 2,100+ bookings in its first four months.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "how he builds",
    value:
      "AI agents in Claude Code write most of the code. He owns architecture, code review and release.",
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

export const TLDR_FOOTER = "The resume has the rest.";

// The hero subline (docs/mockups/front-door-1-hero.html): the `looking for`
// and `where` rows fused into one sentence a visitor doesn't have to scroll
// for. Same claims and source file, checked like the rows.
export const POSITIONING: TldrRow = {
  label: "positioning",
  value:
    "Looking for a RevOps / GTM systems role at an AI-forward company. Toronto, ON. Canadian citizen, no visa sponsorship needed.",
  source: "content/knowledge/faq.md",
};

// The role line above the H1, in the words a recruiter searches for: revenue
// operations, sales operations. Also the og:image's text. Sidhant's H1 stays
// as he wrote it.
//
// Two claims, both the resume's: he is a sales operations specialist and an
// "AI-native revenue operations builder", and the tools are for sales and
// finance ("quarter-end close infrastructure for global sales and finance
// teams at Nokia"; "vague requests from sales and finance leadership").
// Checked like the rows.
export const ROLE_LINE: TldrRow = {
  label: "role",
  value: "Revenue and sales operations: I build the tools sales and finance teams run on.",
  source: "content/knowledge/resume.md",
};

// The two case-study cards under the tl;dr: one number each, the biggest true
// one for the reader the site is for. Nokia first, as in the rows. Dell stays
// off the homepage: it is a 2018 internship, and its $129M is an estimate.
//
// `stat` and `statLabel` together are a claim, checked against `source` by
// evals/track-b.test.mjs like every row.
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
    statLabel: "users on the sales reporting he moved from Salesforce Analytics to Power BI",
    href: "/projects/nokia",
    source: "content/knowledge/projects-nokia.md",
  },
  {
    slug: "adarle20",
    title: "A Darle 20",
    stat: "2,100+",
    statLabel: "bookings in the marketplace's first four months",
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

// #26: the first four things a recruiter asks. They replace the old chips
// rather than adding a recruiter mode.
//
// None may trip `looksLikeJobPosting` or `looksLikeSiteQuestion`: a suggested
// question that forces a roleFit call or loads the repo corpus turns the
// site's own affordance into its worst path. Asserted in
// evals/track-b.test.mjs.
export const SUGGESTED_QUESTIONS = [
  "Give me the short version",
  "What has he shipped end to end?",
  "Is he a fit for a RevOps role at an AI-forward company?",
  "What did he build at Nokia?",
];

/** The chip the `/fit` slash command sends. One string, two surfaces. */
export const FIT_QUESTION = SUGGESTED_QUESTIONS[2];
