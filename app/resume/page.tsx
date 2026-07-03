import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { MonoLabel } from "@/components/mono-label";
import { ResumeDownloadButton } from "@/components/resume-download-button";

export const metadata: Metadata = {
  title: "Resume",
  description:
    "The current version, last updated [TODO: month year].",
};

export default function ResumePage() {
  return (
    <Section divider="none">
      <Container className="py-16">
        <h1 className="font-sans text-[30px] font-semibold tracking-[-0.025em] text-ink">
          Resume
        </h1>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft md:text-base">
          The current version, last updated{" "}
          <span className="font-mono text-faint">[TODO: month year]</span>. A
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

        {/* Resume body — built from docs/resume/resume-source.md verbatim.
            No phone number ships on any web surface. */}
        <div className="mt-16 border-t border-ink pt-10">
          <h2 className="font-mono text-xs text-faint">Toronto, ON</h2>
          <p className="mt-1 font-mono text-xs text-faint">
            hello@sidhantmathur.com · linkedin.com/in/sidhantmathur ·
            github.com/sidhantmathur · sidhantmathur.com
          </p>

          <div className="mt-10">
            <MonoLabel>Summary</MonoLabel>
            <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
              AI-native technical operator who turns ambiguous business problems into
              shipped software. 3+ years building internal tools, automations, and data
              workflows for global sales and finance teams at Nokia (150+ users across 7
              regions), plus a full-stack marketplace architected and launched end-to-end by
              directing AI coding agents. Targeting GTM engineering, revenue systems, and
              solutions engineering roles at AI-native companies.
            </p>
          </div>

          <div className="mt-10">
            <MonoLabel>Experience</MonoLabel>

            <div className="mt-4">
              <h3 className="font-sans text-lg font-semibold text-ink">
                Nokia — Toronto, ON
              </h3>
              <p className="mt-3 font-mono text-xs text-faint">
                Sales operations specialist (internal tools &amp; automation) · 2024 – present
              </p>
              <ul className="mt-2 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
                <li>
                  Built a self-serve Power App used by 80+ stakeholders across 7 regions for
                  quarterly executive reporting, replacing manual data collection and saving
                  finance staff 4–6 hours/day at quarter-end close.
                </li>
                <li>
                  Migrated all sales reporting from Salesforce Analytics to Power BI for 150+
                  users — owned data modeling, transformation logic (SQL/DAX), and global
                  stakeholder rollout end-to-end.
                </li>
                <li>
                  Sole owner of every tool shipped: requirements gathering, executive demos,
                  user support, bug triage, and rapid iteration across global time zones.
                </li>
                <li>
                  Translate vague business requests into working Salesforce and Power Platform
                  automations, increasingly integrating LLMs and Python into production
                  workflows.
                </li>
              </ul>

              <p className="mt-6 font-mono text-xs text-faint">
                Workforce management specialist · Oct 2022 – 2024
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
                Founder &amp; full-stack developer · Feb 2025 – present
              </p>
              <ul className="mt-2 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
                <li>
                  Marketplace connecting tabletop-game hosts with players for paid sessions in
                  Latin America.
                </li>
                <li>
                  Architected and shipped the entire product end-to-end by directing AI coding
                  agents (TypeScript, React/Next.js, Supabase/PostgreSQL, Prisma, Vercel).
                </li>
                <li>
                  Built an autonomous multi-agent code-audit workflow with Claude Code that
                  reviews, refactors, and regression-tests the codebase — LLM agents running
                  against production code.
                </li>
                <li>
                  Integrated Stripe Connect for host payouts, platform fees, and OXXO cash
                  payments (Mexican market); architected API data flows across Stripe,
                  Supabase, and transactional email.
                </li>
                <li>
                  Built real-time chat, booking/reservations, email notifications, refunds,
                  and authentication.
                </li>
              </ul>
            </div>

            <div className="mt-10">
              <h3 className="font-sans text-lg font-semibold text-ink">
                Freelance web development &amp; consulting — remote
              </h3>
              <p className="mt-3 font-mono text-xs text-faint">
                Self-employed · May 2019 – present
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
                  Resolved a major client security breach, un-blacklisting their sites and
                  saving thousands in server costs.
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
                  Built an ML model predicting sale outcomes at 91% accuracy, surfacing 20,000
                  leads worth $129M in pipeline.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10">
            <MonoLabel>Education</MonoLabel>
            <ul className="mt-3 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
              <li>
                B.S. in Business Administration — The University of Texas at Dallas,
                Aug 2016 – May 2019
              </li>
              <li>
                Software Engineering Immersive — General Assembly, Toronto,
                Sep 2020 – Jan 2021
              </li>
            </ul>
          </div>

          <div className="mt-10">
            <MonoLabel>Technical skills</MonoLabel>
            <ul className="mt-3 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
              <li>
                <strong className="text-ink">AI &amp; automation:</strong> LLM integration &amp;
                agentic workflows (Claude Code, Anthropic API), prompt engineering, Python
                automation
              </li>
              <li>
                <strong className="text-ink">Engineering:</strong> TypeScript, React, Next.js,
                Node.js, Python, SQL, PostgreSQL, Supabase, Prisma, Stripe, REST APIs, ETL &amp;
                data workflows
              </li>
              <li>
                <strong className="text-ink">GTM systems &amp; analytics:</strong> Salesforce,
                Power BI, DAX, Power Apps / Power Automate, SharePoint, Excel/VBA
              </li>
              <li>
                <strong className="text-ink">Domain:</strong> GTM / revenue systems, sales ops
                &amp; RevOps, solutions engineering / pre-sales, forecasting, stakeholder
                management
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
