import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { MonoLabel } from "@/components/mono-label";
import { ResumeDownloadButton } from "@/components/resume-download-button";

export const metadata: Metadata = {
  title: "Resume",
  description: "The current version, last updated July 2026.",
};

export default function ResumePage() {
  return (
    <Section divider="none">
      <Container className="py-16">
        <h1 className="font-sans text-[30px] font-semibold tracking-[-0.025em] text-ink">
          Resume
        </h1>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft md:text-base">
          The current version, last updated July 2026. A
          plain-text version lives at{" "}
          <Link
            href="/resume.md"
            className="font-mono text-[13px] no-underline hover:underline"
          >
            /resume.md
          </Link>{" "}
          if you&apos;d rather feed it to an AI — I won&apos;t take it personally.
        </p>

        <ResumeDownloadButton />

        {/* Resume body matches docs/Sidhant_Mathur_Resume.pdf (July 2026). */}
        <div className="mt-16 border-t border-ink pt-10">
          <h2 className="font-mono text-xs text-faint">Toronto, ON</h2>
          <p className="mt-1 font-mono text-xs text-faint">
            613-795-9684 · hello@sidhantmathur.com · linkedin.com/in/sidhantmathur ·
            github.com/sidhantmathur · sidhantmathur.com
          </p>

          <div className="mt-10">
            <MonoLabel>Summary</MonoLabel>
            <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
              AI-native revenue operations builder who turns ambiguous business problems
              into shipped software. 3+ years owning sales reporting, forecasting, and
              quarter-end close infrastructure for global sales and finance teams at Nokia
              (150+ users across 7 regions). Co-Founder &amp; CTO of A Darle 20, a live
              two-sided marketplace with 1,400+ users and 2,100+ bookings, architected and
              shipped solo with an AI-agent-heavy development workflow. Looking for a
              RevOps / GTM systems role at an AI-forward company.
            </p>
          </div>

          <div className="mt-10">
            <MonoLabel>Experience</MonoLabel>

            <div className="mt-4">
              <h3 className="font-sans text-lg font-semibold text-ink">
                Nokia — Toronto, ON
              </h3>
              <p className="mt-3 font-mono text-xs text-faint">
                Sales operations specialist (internal tools &amp; automation) · Jun 2024 – Present
              </p>
              <ul className="mt-2 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
                <li>
                  Built a self-serve Power App used by 80+ stakeholders across 7 regions for
                  quarterly executive reporting — eliminating a manual collection process
                  that consumed one finance analyst&apos;s entire workday, every day of
                  quarter-end close.
                </li>
                <li>
                  Migrated all sales reporting from Salesforce Analytics to Power BI for 150+
                  users — owned data modeling, transformation logic (SQL/DAX), and the global
                  stakeholder rollout end-to-end.
                </li>
                <li>
                  Own every tool through its full lifecycle — translating vague requests
                  from sales and finance leadership into scoped requirements, then
                  executive demos, global rollout, user support, and rapid iteration across
                  time zones.
                </li>
              </ul>

              <p className="mt-6 font-mono text-xs text-faint">
                Workforce management specialist · Oct 2022 – Jun 2024
              </p>
              <ul className="mt-2 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
                <li>
                  Owned headcount reporting and forecasting for a 3,000–4,000-person
                  organization.
                </li>
                <li>
                  Identified $1.2M in real-estate cost savings by analyzing lab and facility
                  utilization data.
                </li>
              </ul>
            </div>

            <div className="mt-10">
              <h3 className="font-sans text-lg font-semibold text-ink">
                A Darle 20 (&quot;Let&apos;s Go 20&quot;) — adarle20.com — Toronto, ON
              </h3>
              <p className="mt-3 font-mono text-xs text-faint">
                Co-Founder &amp; CTO (solo developer) · Aug 2025 – Present · launched Mar
                2026
              </p>
              <ul className="mt-2 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
                <li>
                  Architected and shipped the entire marketplace as solo developer —
                  TypeScript, Next.js, Supabase/PostgreSQL, Stripe Connect, Vercel —
                  running an AI-agent-heavy development workflow (Claude Code), with
                  hands-on ownership of architecture, code review, and release.
                </li>
                <li>
                  Grew to 1,400+ registered users, 127 hosts, and 2,100+ bookings in the
                  first four months post-launch, with 200–400 unique visitors daily.
                </li>
                <li>
                  Instrumented the funnel end-to-end — bookings, conversion,
                  cancellations, refunds, host activation — and use the data to steer
                  product and monetization decisions.
                </li>
                <li>
                  Built the technology behind a flagship 251-player event at a
                  19,000-attendee convention, rated 4.96/5 by attendees.
                </li>
                <li>
                  Integrated Stripe Connect for host payouts, platform fees, and OXXO cash
                  payments — solution-designing payment flows around a low-card-penetration
                  Mexican customer base, with automated refunds and transactional email.
                </li>
                <li>
                  Run an autonomous multi-agent code-audit workflow (Claude Code) that
                  reviews, refactors, and regression-tests the production codebase.
                </li>
              </ul>
            </div>

            <div className="mt-10">
              <h3 className="font-sans text-lg font-semibold text-ink">
                Freelance web development &amp; consulting — remote
              </h3>
              <p className="mt-3 font-mono text-xs text-faint">
                Self-employed · May 2019 – Oct 2022
              </p>
              <ul className="mt-2 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
                <li>
                  Advised a startup client on web-development strategy, saving $100k+ in
                  agency fees.
                </li>
                <li>
                  Built custom client solutions — an integrated web ordering experience and an
                  affiliate-marketing site.
                </li>
                <li>
                  Resolved a client security breach and restored their domains from email
                  blacklists.
                </li>
              </ul>
            </div>

            <div className="mt-10">
              <h3 className="font-sans text-lg font-semibold text-ink">
                Dell Technologies — Austin, TX
              </h3>
              <p className="mt-3 font-mono text-xs text-faint">
                Marketing intern · May 2018 – Aug 2018
              </p>
              <ul className="mt-2 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
                <li>
                  Built a propensity model (Azure ML) on Dell&apos;s historical customer
                  database to identify cross-sell targets for a high-margin software
                  product — surfaced ~20,000 qualified accounts representing an estimated
                  $129M pipeline (segment-level average deal size).
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10">
            <MonoLabel>Education</MonoLabel>
            <ul className="mt-3 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
              <li>
                B.S. in Business Administration — The University of Texas at Dallas,
                2016 – 2019
              </li>
              <li>
                Software Engineering Immersive — General Assembly, Toronto,
                2020 – 2021
              </li>
            </ul>
          </div>

          <div className="mt-10">
            <MonoLabel>Technical skills</MonoLabel>
            <ul className="mt-3 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
              <li>
                <strong className="text-ink">GTM systems &amp; analytics:</strong> Salesforce,
                Power BI, DAX, Power Apps / Power Automate, SharePoint, Excel/VBA, forecasting
              </li>
              <li>
                <strong className="text-ink">AI &amp; automation:</strong> LLM integration &amp;
                agentic workflows (Claude Code, Anthropic API), prompt engineering, Python
                automation
              </li>
              <li>
                <strong className="text-ink">Engineering:</strong> TypeScript, React, Next.js,
                Node.js, Python, SQL, PostgreSQL, Supabase, Stripe, REST APIs, ETL &amp;
                data workflows
              </li>
            </ul>
          </div>

          <div className="mt-10">
            <MonoLabel>Other</MonoLabel>
            <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
              Canadian citizen
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
