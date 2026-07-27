import type { Metadata } from "next";
import { DocPage } from "@/components/layout/doc-page";
import Image from "next/image";
import Link from "next/link";
import { MonoLabel } from "@/components/mono-label";
import { ResumeDownloadButton } from "@/components/resume-download-button";

export const metadata: Metadata = {
  title: "Resume",
  description: "The current version, last updated July 2026.",
};

export default function ResumePage() {
  return (
    <DocPage>
        <h1 className="text-[24px] font-medium tracking-[-0.02em] text-text">
          Resume
        </h1>
        <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.7] text-text-soft">
          The current version, last updated July 2026. A
          plain-text version lives at{" "}
          <Link
            href="/resume.md"
            className="text-text underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
          >
            /resume.md
          </Link>{" "}
          if you&apos;d rather feed it to an AI — I won&apos;t take it personally.
        </p>

        <ResumeDownloadButton />

        <nav
          aria-label="Resume sections"
          className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-y border-line py-3 text-[11px]"
        >
          {[
            ["Summary", "#summary"],
            ["Experience", "#experience"],
            ["Education", "#education"],
            ["Technical skills", "#technical-skills"],
            ["Other", "#other"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-text-faint no-underline transition-colors hover:text-accent"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Resume body matches docs/Sidhant_Mathur_Resume.pdf (July 2026). */}
        <div className="mt-8">
          <h2 className="font-mono text-xs text-text-faint">Toronto, ON</h2>
          <p className="mt-1 font-mono text-xs text-text-faint">
            613-795-9684 · hello@sidhantmathur.com · linkedin.com/in/sidhantmathur ·
            github.com/sidhantmathur · sidhantmathur.com
          </p>

          <div id="summary" className="mt-10 scroll-mt-14">
            <MonoLabel>Summary</MonoLabel>
            <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.7] text-text-soft">
              AI-native revenue operations builder who turns ambiguous business problems
              into shipped software. 3+ years owning sales reporting, forecasting, and
              quarter-end close infrastructure for global sales and finance teams at Nokia
              (150+ users across 7 regions). Co-Founder &amp; CTO of A Darle 20, a live
              two-sided marketplace with 1,400+ users and 2,100+ bookings, architected and
              shipped solo with an AI-agent-heavy development workflow. Looking for a
              RevOps / GTM systems role at an AI-forward company.
            </p>
          </div>

          <div id="experience" className="mt-10 scroll-mt-14">
            <MonoLabel>Experience</MonoLabel>

            <div className="mt-4">
              <h3 className="text-[15px] font-medium text-text">
                Nokia — Toronto, ON{" "}
                <Link href="/projects/nokia" className="ml-1 text-[11px] font-normal text-text-faint no-underline hover:text-accent">
                  case study →
                </Link>
              </h3>
              <p className="mt-3 font-mono text-xs text-text-faint">
                Sales operations specialist (internal tools &amp; automation) · Jun 2024 – Present
              </p>
              <ul className="mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-[13px] leading-[1.7] text-text-soft marker:text-text-faint">
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

              <p className="mt-6 font-mono text-xs text-text-faint">
                Workforce management specialist · Oct 2022 – Jun 2024
              </p>
              <ul className="mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-[13px] leading-[1.7] text-text-soft marker:text-text-faint">
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
              <h3 className="text-[15px] font-medium text-text">
                A Darle 20 (&quot;Let&apos;s Go 20&quot;) — adarle20.com{" "}
                <Link href="/projects/adarle20" className="ml-1 text-[11px] font-normal text-text-faint no-underline hover:text-accent">
                  case study →
                </Link>
              </h3>
              <p className="mt-3 font-mono text-xs text-text-faint">
                Co-Founder &amp; CTO (solo developer) · Aug 2025 – Present · launched Mar
                2026
              </p>
              <ul className="mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-[13px] leading-[1.7] text-text-soft marker:text-text-faint">
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

              <figure className="mt-6 max-w-[72ch]">
                <div className="relative aspect-[16/10] border border-line">
                  <Image
                    src="/images/adarle20-listings.png"
                    alt="A Darle 20 session listings, showing hosted games available to book"
                    fill
                    sizes="(max-width: 768px) 100vw, 72ch"
                    className="object-cover object-top"
                  />
                </div>
                <figcaption className="mt-2 text-[11px] text-text-faint">
                  A Darle 20 — session listings. The Nokia work is internal tooling behind a
                  corporate login, so there is nothing to show from it here.
                </figcaption>
              </figure>
            </div>

            <div className="mt-10">
              <h3 className="text-[15px] font-medium text-text">
                Freelance web development &amp; consulting — remote
              </h3>
              <p className="mt-3 font-mono text-xs text-text-faint">
                Self-employed · May 2019 – Oct 2022
              </p>
              <ul className="mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-[13px] leading-[1.7] text-text-soft marker:text-text-faint">
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
              <h3 className="text-[15px] font-medium text-text">
                Dell Technologies — Austin, TX
              </h3>
              <p className="mt-3 font-mono text-xs text-text-faint">
                Marketing intern · May 2018 – Aug 2018
              </p>
              <ul className="mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-[13px] leading-[1.7] text-text-soft marker:text-text-faint">
                <li>
                  Built a propensity model (Azure ML) on Dell&apos;s historical customer
                  database to identify cross-sell targets for a high-margin software
                  product — surfaced ~20,000 qualified accounts representing an estimated
                  $129M pipeline (segment-level average deal size).
                </li>
              </ul>
            </div>
          </div>

          <div id="education" className="mt-10 scroll-mt-14">
            <MonoLabel>Education</MonoLabel>
            <ul className="mt-3 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-text-soft">
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

          <div id="technical-skills" className="mt-10 scroll-mt-14">
            <MonoLabel>Technical skills</MonoLabel>
            <ul className="mt-3 max-w-[58ch] list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-text-soft">
              <li>
                <strong className="text-text">GTM systems &amp; analytics:</strong> Salesforce,
                Power BI, DAX, Power Apps / Power Automate, SharePoint, Excel/VBA, forecasting
              </li>
              <li>
                <strong className="text-text">AI &amp; automation:</strong> LLM integration &amp;
                agentic workflows (Claude Code, Anthropic API), prompt engineering, Python
                automation
              </li>
              <li>
                <strong className="text-text">Engineering:</strong> TypeScript, React, Next.js,
                Node.js, Python, SQL, PostgreSQL, Supabase, Stripe, REST APIs, ETL &amp;
                data workflows
              </li>
            </ul>
          </div>

          <div id="other" className="mt-10 scroll-mt-14">
            <MonoLabel>Other</MonoLabel>
            <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.7] text-text-soft">
              Canadian citizen
            </p>
          </div>
        </div>
      </DocPage>
  );
}
