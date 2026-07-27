// Prototype-only data for the /lab route.
//
// Every string here is an excerpt of existing content — content/knowledge/resume.md
// and content/projects.ts — reproduced verbatim so the context panel can "zoom
// into" the resume without inventing copy. Nothing here is new site copy.
// When /lab graduates, this file should be replaced by a real citation index
// generated from content/knowledge/*.md at build time (same pipeline as
// lib/knowledge.generated.ts).

export type ResumeSection = {
  id: string;
  /** Panel heading — the resume's own heading, verbatim. */
  heading: string;
  /** Dateline / role line as it appears on the resume. */
  meta: string;
  /** Bullets, verbatim from resume.md. */
  bullets: string[];
};

export const RESUME_SECTIONS: ResumeSection[] = [
  {
    id: "summary",
    heading: "Summary",
    meta: "Toronto, ON",
    bullets: [
      "AI-native revenue operations builder who turns ambiguous business problems into shipped software.",
      "3+ years owning sales reporting, forecasting, and quarter-end close infrastructure for global sales and finance teams at Nokia (150+ users across 7 regions).",
      "Co-Founder & CTO of A Darle 20, a live two-sided marketplace with 1,400+ users and 2,100+ bookings, architected and shipped solo with an AI-agent-heavy development workflow.",
      "Looking for a RevOps / GTM systems role at an AI-forward company.",
    ],
  },
  {
    id: "nokia",
    heading: "Nokia — Toronto, ON",
    meta: "Sales operations specialist (internal tools & automation) · Jun 2024 – Present",
    bullets: [
      "Built a self-serve Power App used by 80+ stakeholders across 7 regions for quarterly executive reporting — eliminating a manual collection process that consumed one finance analyst's entire workday, every day of quarter-end close.",
      "Migrated all sales reporting from Salesforce Analytics to Power BI for 150+ users — owned data modeling, transformation logic (SQL/DAX), and the global stakeholder rollout end-to-end.",
      "Own every tool through its full lifecycle — translating vague requests from sales and finance leadership into scoped requirements, then executive demos, global rollout, user support, and rapid iteration across time zones.",
      "Workforce management specialist (Oct 2022 – Jun 2024): owned headcount reporting and forecasting for a 3,000–4,000-person organization; identified $1.2M in real-estate cost savings by analyzing lab and facility utilization data.",
    ],
  },
  {
    id: "adarle20",
    heading: 'A Darle 20 ("Let\'s Go 20") — adarle20.com',
    meta: "Co-Founder & CTO (solo developer) · Aug 2025 – Present · launched Mar 2026",
    bullets: [
      "Architected and shipped the entire marketplace as solo developer — TypeScript, Next.js, Supabase/PostgreSQL, Stripe Connect, Vercel — running an AI-agent-heavy development workflow (Claude Code), with hands-on ownership of architecture, code review, and release.",
      "Grew to 1,400+ registered users, 127 hosts, and 2,100+ bookings in the first four months post-launch, with 200–400 unique visitors daily.",
      "Instrumented the funnel end-to-end — bookings, conversion, cancellations, refunds, host activation — and use the data to steer product and monetization decisions.",
      "Built the technology behind a flagship 251-player event at a 19,000-attendee convention, rated 4.96/5 by attendees.",
      "Integrated Stripe Connect for host payouts, platform fees, and OXXO cash payments — solution-designing payment flows around a low-card-penetration Mexican customer base, with automated refunds and transactional email.",
      "Run an autonomous multi-agent code-audit workflow (Claude Code) that reviews, refactors, and regression-tests the production codebase.",
    ],
  },
];

export const RESUME_BY_ID = Object.fromEntries(
  RESUME_SECTIONS.map((s) => [s.id, s]),
) as Record<string, ResumeSection>;

/** Maps a project slug from the showProject tool onto the resume section it evidences. */
export const SLUG_TO_RESUME: Record<string, string> = {
  adarle20: "adarle20",
  nokia: "nokia",
};

export const RAIL_LINKS = [
  { label: "Resume", href: "/resume", external: false },
  { label: "Resume PDF", href: "/resume.pdf", external: true },
  { label: "A Darle 20", href: "/projects/adarle20", external: false },
  { label: "Nokia", href: "/projects/nokia", external: false },
  { label: "Dell", href: "/projects/dell-ml", external: false },
  { label: "Colophon", href: "/colophon", external: false },
];

export const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com/sidhantmathur" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/sidhantmathur" },
  { label: "Email", href: "mailto:hello@sidhantmathur.com" },
];

export type SlashCommand = {
  name: string;
  hint: string;
  /** 'panel' opens the context panel locally; 'send' dispatches a chat message. */
  kind: "panel" | "send";
  /** For kind==='panel': which panel view to open. */
  panel?: "resume" | "projects" | "contact";
  /** For kind==='send': the message text (verbatim from docs/site-copy.md). */
  message?: string;
};

// Slash-command labels are UI affordances, not site copy. The one command that
// sends a message reuses a suggested question verbatim from site-copy.md.
export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "/resume", hint: "Open the resume in the panel", kind: "panel", panel: "resume" },
  { name: "/projects", hint: "List the three projects", kind: "panel", panel: "projects" },
  { name: "/contact", hint: "Show contact links", kind: "panel", panel: "contact" },
  {
    name: "/fit",
    hint: "Ask about role fit",
    kind: "send",
    message: "Is he a fit for a solutions engineering role?",
  },
];
