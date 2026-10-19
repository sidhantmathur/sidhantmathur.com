// Recruiter-facing copy — the TL;DR (#25) and the suggested questions (#26).
//
// WHY THIS IS ITS OWN MODULE
//
// Two reasons, both about keeping copy honest rather than about tidiness.
//
//   1. It imports nothing. The eval suite can therefore read these strings as
//      values rather than pattern-matching them out of a component, which is
//      what lets evals/track-b.test.mjs run the site's OWN citation checker
//      (lib/verify.ts) over every TL;DR row against the corpus file it names.
//      A row that stops being supported by content/knowledge/ fails the suite.
//   2. The chip and the `/fit` slash command are the same question, and were
//      previously the same string typed twice. One export now, so they cannot
//      drift into two questions with one answer.
//
// Everything here is drafted copy under CLAUDE.md's ledger rule and is logged
// in docs/copy-ledger.md. The TL;DR is the only block on this site that makes
// factual claims about Sidhant rather than about the site, so nothing in it is
// written: every value is lifted from content/knowledge/ or the resume, and
// `source` names the file it came from.

export type TldrRow = {
  /** Short mono label, lowercase, like the status strip's readouts. */
  label: string;
  value: string;
  /** The corpus file this row's facts come from. Checked by the suite. */
  source: string;
};

export const TLDR_LABEL = "tl;dr";

// Scan-shaped rather than prose on purpose: the reader this exists for has not
// started reading yet. Six seconds, per decisions #25.
//
// ORDER (wave 2, 2026-10-19). Nokia first and labelled as current, because it
// is: the council review found the current job and the only sales-ops evidence
// labelled "before that" and sitting second, under a tabletop marketplace. For
// the RevOps and sales-ops roles he is applying to, Nokia is the proof and A
// Darle 20 the differentiator, so they now run in that order — and the Nokia
// rows carry outcomes (the close process the Power App ended, the migration's
// reach) rather than a job title alone. Every figure is the resume's.
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
      "A self-serve Power App used by 80+ stakeholders across 7 regions, which ended a manual process that took one finance analyst's entire workday, every day of quarter-end close — and the migration of all sales reporting from Salesforce Analytics to Power BI for 150+ users.",
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

// The hero subline — the front-door pass (docs/mockups/front-door-1-hero.html,
// approved 2026-08-23). The `looking for` and `where` rows fused into the one
// sentence a visitor must not have to scroll for. Same claims, same source
// file; the eval suite runs the citation checker over this string exactly as
// it does over the rows, so it cannot drift from the corpus independently.
export const POSITIONING: TldrRow = {
  label: "positioning",
  value:
    "Looking for a RevOps / GTM systems role at an AI-forward company. Toronto, ON — Canadian citizen, no visa sponsorship needed.",
  source: "content/knowledge/faq.md",
};

// The name and role line above the H1 (wave 2). The council's finding: the
// front door didn't name him or his role — the name was a 13px header label
// and "I learn what the problem needs…" is a personality line, not a job. So
// this sits over it, in the words a recruiter searches for: revenue
// operations, sales operations. Sidhant's H1 stays exactly as it was.
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

// The two case-study cards under the tl;dr (wave 2). One number each, the
// biggest true one for the reader the site is for, and a link to the long
// version. Nokia first for the same reason the rows are. Dell stays off the
// homepage — it is a 2018 internship, and its $129M is an estimate.
//
// `stat` and `statLabel` together are a claim and are checked against
// `source` by evals/track-b.test.mjs, like every row.
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
// already carry. Derived, not retyped — the full six-row list above stays the
// canonical set and stays fully checked.
export const HERO_TLDR = RECRUITER_TLDR.filter(
  (r) => r.label !== "looking for" && r.label !== "where",
);

// #26 — a copy swap, per the decisions doc's note that the recruiter chips
// replace the current ones rather than adding a mode. The old three ("What did
// Sidhant build at Nokia?", "How does A Darle 20 work?", "Is he a fit for a
// solutions engineering role?") were a demo of the site's range; these are the
// first four things a recruiter asks, including the screening question that
// otherwise costs an email and a day.
//
// None of them may trip `looksLikeJobPosting` or `looksLikeSiteQuestion` — a
// suggested question that forces a roleFit call or loads the repo corpus turns
// the site's own affordance into its worst path. Asserted in
// evals/track-b.test.mjs.
//
// Wave 2 swapped the fourth. "Does he need visa sponsorship?" asked what the
// hero subline already answers in so many words, so it spent a chip on a
// question nobody left the first screen with. The Nokia work is the proof for
// the roles he is applying to and had no chip at all.
export const SUGGESTED_QUESTIONS = [
  "Give me the 30-second version",
  "What has he shipped end to end?",
  "Is he a fit for a RevOps role at an AI-forward company?",
  "What did he build at Nokia?",
];

/** The chip the `/fit` slash command sends. One string, two surfaces. */
export const FIT_QUESTION = SUGGESTED_QUESTIONS[2];
