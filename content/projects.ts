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
      "A marketplace connecting tabletop game hosts with paying players across Latin America. I designed and shipped the whole product solo (bookings, payments, chat, refunds and notifications) with an AI-agent-heavy development workflow. Four months after launch it had 1,400+ registered users, 127 hosts and 2,100+ bookings.",
    role: "Co-Founder & CTO",
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
      "Self-serve reporting tools for a global sales organization. A Power App used by 80+ stakeholders across seven regions replaced a manual quarterly process. I also moved all sales reporting from Salesforce Analytics to Power BI for 150+ users, and I model and maintain it.",
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
      "As an intern, I built a propensity model on Dell's historical customer database to find cross-sell targets for a high-margin software product. It surfaced about 20,000 qualified accounts representing an estimated $129M in pipeline.",
    role: "Marketing intern",
    // Azure ML only: it is the one tool content/knowledge/projects-dell.md
    // names. Python stays off until Sidhant confirms it (copy ledger, pending).
    stack: ["Azure ML"],
    status: "2018",
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
