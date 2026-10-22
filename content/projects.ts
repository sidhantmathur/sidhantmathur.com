// The three projects' card copy and metadata, in one place. Read by /projects,
// the case-study layout's "next case study" link, the shell's project panel
// and panel title, and the chat route's `showProject` tool.
//
// The copy is verbatim from docs/site-copy.md (Homepage → Projects section,
// cards 1–3). Change it there first and don't rephrase it here: site-copy.md
// wins every text conflict.

export type ProjectSlug = "adarle20" | "nokia" | "dell-ml";

export type Project = {
  slug: ProjectSlug;
  /** Corner badge number for the card, e.g. "01". */
  index: string;
  /** Card / case-study title. */
  title: string;
  /** Card body copy, verbatim from site-copy.md. */
  description: string;
  /** Metadata strip: role. */
  role: string;
  /** Metadata strip: stack, rendered comma-joined. */
  stack: string[];
  /** Metadata strip: status. */
  status: string;
  /** Case-study href. */
  caseStudyHref: string;
  /** Image sent with the showProject tool result. Only A Darle 20 has one. */
  image?: string;
};

export const PROJECTS: Record<ProjectSlug, Project> = {
  adarle20: {
    slug: "adarle20",
    index: "02",
    title: "A Darle 20",
    description:
      "A live marketplace for tabletop game sessions in Latin America, which I built as its only developer and run as co-founder. Four months after launch: 1,400+ registered users, 127 hosts and 2,100+ bookings. I shipped bookings, payments, chat and refunds, with AI agents in Claude Code writing most of the code.",
    role: "Co-founder and CTO",
    stack: ["TypeScript", "Next.js", "Supabase", "Stripe Connect"],
    status: "Live at adarle20.com",
    caseStudyHref: "/projects/adarle20",
    image: "/images/adarle20-listings.png",
  },
  nokia: {
    slug: "nokia",
    index: "01",
    title: "Reporting tools at Nokia",
    description:
      "A self-serve app I built replaced a manual quarter-end process for 80+ stakeholders in 7 regions. That process took one finance analyst's entire workday, every day of close. I also moved sales reporting for 150+ users from Salesforce Analytics to Power BI, and I own it from data model to user support.",
    role: "Sales operations specialist",
    stack: ["Power Apps", "Power BI", "SQL", "DAX", "Salesforce"],
    status: "In production since 2024",
    caseStudyHref: "/projects/nokia",
  },
  "dell-ml": {
    slug: "dell-ml",
    index: "03",
    title: "Sales prediction model at Dell",
    description:
      "A propensity model that surfaced about 20,000 qualified cross-sell accounts for a high-margin software product: an estimated $129M in pipeline at segment-level average deal sizes. I built it as an intern on Dell's historical customer database.",
    role: "Marketing intern",
    // Azure ML only: it is the one tool content/knowledge/projects-dell.md
    // names. Python stays off until Sidhant confirms it (copy ledger, pending).
    stack: ["Azure ML"],
    status: "Internship, May–Aug 2018",
    caseStudyHref: "/projects/dell-ml",
  },
};

// The order the site lists them in: /projects, and the "next case study" at
// the end of each one. Nokia first because it is the current job and the
// evidence for the sales-ops roles he is applying to.
export const PROJECT_LIST: Project[] = [
  PROJECTS.nokia,
  PROJECTS.adarle20,
  PROJECTS["dell-ml"],
];
