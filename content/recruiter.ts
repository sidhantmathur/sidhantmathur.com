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
// is applying to, Nokia is the proof and A Darle 20 the differentiator. Every
// figure is the resume's.
//
// One row in the block: what each project shipped is on its case-study card,
// so the block doesn't state the same numbers the cards do (front-door cut,
// 2026-10-20). "how he builds" (agents write the code) is off the front door
// at Sidhant's call; the chat still answers it from projects-adarle20.md.
export const RECRUITER_TLDR: TldrRow[] = [
  {
    label: "now",
    value:
      "Sales operations specialist at Nokia since Jun 2024, building internal tools and automation for global sales and finance teams.",
    source: "content/knowledge/resume.md",
  },
  {
    label: "looking for",
    value: "A RevOps / GTM systems role at an AI-forward company.",
    source: "content/knowledge/faq.md",
  },
  {
    label: "where",
    value: "Toronto, ON.",
    source: "content/knowledge/faq.md",
  },
];

// Not rendered since the front-door cut: the PDF button and "Resume as a web
// page" are already two ways to the resume. Kept for the markers check.
export const TLDR_FOOTER = "The resume has the rest.";

// The hero subline (docs/mockups/front-door-1-hero.html): the `looking for`
// and `where` rows fused into one sentence a visitor doesn't have to scroll
// for. Same claims and source file, checked like the rows.
export const POSITIONING: TldrRow = {
  label: "positioning",
  value:
    "Looking for a RevOps / GTM systems role at an AI-forward company. Toronto, ON.",
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
    stat: "80+",
    statLabel: "stakeholders across seven regions use the self-serve Power App I built for quarterly executive reporting",
    href: "/projects/nokia",
    source: "content/knowledge/projects-nokia.md",
  },
  {
    slug: "adarle20",
    title: "A Darle 20",
    stat: "2,100+",
    statLabel: "bookings in the first four months of the marketplace I architected and shipped solo",
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
export const FIT_QUESTION = "Is he a fit for a RevOps role at an AI-forward company?";

// #26: the first things a recruiter asks. They replace the old chips rather
// than adding a recruiter mode.
//
// Three including JD_CHIP, so the row sits on one line above the composer at
// laptop widths (Sidhant, 2026-10-20). "What has he shipped end to end?" was
// the one cut: the Nokia chip asks the same thing about the work that matters
// most.
//
// None may trip `looksLikeJobPosting` or `looksLikeSiteQuestion`: a suggested
// question that forces a roleFit call or loads the repo corpus turns the
// site's own affordance into its worst path. Asserted in
// evals/track-b.test.mjs.
export const SUGGESTED_QUESTIONS = [
  "Give me the short version",
  "What did he build at Nokia?",
];

// The chip in front of the two questions: opens the job-description fit check,
// the one answer here built for the reader's own role. An action rather than a
// question, so it isn't in SUGGESTED_QUESTIONS. It replaced the fit question as
// a chip (front-door cut, 2026-10-20): asking the site whether he fits a role
// it names itself reads as a sales pitch, and the posting is the honest
// version of the same question. /fit still sends FIT_QUESTION.
export const JD_CHIP = "Paste a job description";
