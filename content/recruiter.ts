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
export const SUGGESTED_QUESTIONS = [
  "Give me the 30-second version",
  "What has he shipped end to end?",
  "Is he a fit for a RevOps role at an AI-forward company?",
  "Does he need visa sponsorship?",
];

/** The chip the `/fit` slash command sends. One string, two surfaces. */
export const FIT_QUESTION = SUGGESTED_QUESTIONS[2];
