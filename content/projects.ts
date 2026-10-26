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
      "A marketplace for tabletop game sessions, based in Puebla, Mexico, which I built as its sole developer and run part-time as co-founder and CTO. Since its March 2026 launch: 2,100+ users, 110+ hosts and 3,600+ session reservations from 1,000+ players.",
    role: "Co-founder and CTO (part-time)",
    stack: ["Next.js", "TypeScript", "Supabase", "Stripe Connect"],
    status: "Live at adarle20.com",
    caseStudyHref: "/projects/adarle20",
    image: "/images/adarle20-listings.png",
  },
  nokia: {
    slug: "nokia",
    index: "01",
    title: "Reporting and tooling at Nokia",
    description:
      "I build and run the tools a 7-region sales organization reports on: the weekly operating review tool regional sales ops teams use to compile the Chief Customer Officer's weekly report, and the self-serve Power App behind quarter-end executive reporting for 80+ stakeholders. I also keep alive the ones I inherited, including the sales incentive calculations for 900+ staff.",
    role: "Sales operations specialist",
    stack: ["Power Apps", "Power Automate", "Power BI", "DAX", "Salesforce CRM Analytics"],
    status: "Current role, since Jun 2024",
    caseStudyHref: "/projects/nokia",
  },
  "dell-ml": {
    slug: "dell-ml",
    index: "03",
    title: "Sales prediction model at Dell",
    description:
      "An Azure ML propensity model that found about 20,000 cross-sell accounts, about $129M at the segment's average deal size. I built it as an intern and trained the sales and marketing teams to use its output for lead prioritization.",
    role: "Marketing intern",
    // Azure ML only: it is the one tool the master resume names for Dell.
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
