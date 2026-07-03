// Shared project data — the single source of truth for the three project
// cards' copy. Both the homepage (`app/page.tsx`) and the chat `showProject`
// tool (`app/api/chat/route.ts`) read from here so the card text exists in
// exactly one place.
//
// Every string below is verbatim from docs/site-copy.md (Homepage → Projects
// section, Cards 1–3). Do NOT edit, rephrase, or "improve" this copy — it is
// site copy and site-copy.md wins every text conflict.

export type ProjectSlug = "adarle20" | "nokia" | "dell-ml";

export type Project = {
  slug: ProjectSlug;
  /** Corner badge number for the card, e.g. "01". */
  index: string;
  /** Card / case-study title. */
  title: string;
  /** Card body copy — verbatim from site-copy.md. */
  description: string;
  /** Metadata strip: role. */
  role: string;
  /** Metadata strip: stack, as an array (rendered comma-joined on the card). */
  stack: string[];
  /** Metadata strip: status. */
  status: string;
  /** Case-study href. */
  caseStudyHref: string;
  /** Optional card image — only A Darle 20 has one. */
  image?: string;
};

// Keyed by slug for O(1) lookup in the showProject tool.
export const PROJECTS: Record<ProjectSlug, Project> = {
  adarle20: {
    slug: "adarle20",
    index: "01",
    title: "A Darle 20",
    description:
      "A marketplace connecting tabletop game hosts with paying players across Latin America. I designed and shipped the whole product — bookings, payments, chat, refunds, notifications — by directing AI coding agents through the full build.",
    role: "Founder and developer",
    stack: ["TypeScript", "Next.js", "Supabase", "Stripe Connect"],
    status: "Live at adarle20.com",
    caseStudyHref: "/projects/adarle20",
    image: "/images/adarle20-listings.png",
  },
  nokia: {
    slug: "nokia",
    index: "02",
    title: "Reporting tools at Nokia",
    description:
      "Self-serve reporting tools for a global sales organization. A Power App used by 80+ stakeholders across seven regions replaced a manual quarterly process, and a migration from Salesforce Analytics to Power BI moved 150+ users onto reporting I model and maintain.",
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
      "As an intern, I built a machine learning model that predicted sale outcomes at 91% accuracy and surfaced 20,000 leads worth $129M in pipeline for the sales team.",
    role: "Marketing intern",
    stack: ["Python", "Azure"],
    status: "2018",
    caseStudyHref: "/projects/dell-ml",
  },
};

// Ordered list for rendering the homepage cards in sequence.
export const PROJECT_LIST: Project[] = [
  PROJECTS.adarle20,
  PROJECTS.nokia,
  PROJECTS["dell-ml"],
];
