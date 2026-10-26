import type { Metadata } from "next";
import { DocPage } from "@/components/layout/doc-page";
import Image from "next/image";
import Link from "next/link";
import { MonoLabel } from "@/components/mono-label";
import { ResumeDownloadButton } from "@/components/resume-download-button";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  alternates: {
    canonical: "/resume",
    // /resume.md is the same resume as plain markdown; this advertises it.
    types: { "text/markdown": "/resume.md" },
  },
  title: "Resume",
  description: "The current version, last updated October 2026.",
};

export default function ResumePage() {
  return (
    <DocPage>
        {/* His name is the H1, not "Resume": this is the page most likely to
            be pasted into an ATS note, so it leads with whose it is. */}
        <p className="t-label text-text-faint">Resume</p>
        <h1 className="t-title mt-1 font-medium text-text">{SITE_NAME}</h1>
        <p className="t-body mt-3 max-w-[72ch] text-text-soft">
          The current version, last updated October 2026. There&apos;s a
          plain-text version at{" "}
          <Link
            href="/resume.md"
            // Padding, not min-height: a 44px inline-flex box is an atomic item
            // on the line and drags the paragraph's leading up with it.
            // Vertical padding on an inline element grows the hit area without
            // touching the line box.
            className="-my-2 py-2 text-text underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
          >
            /resume.md
          </Link>{" "}
          for pasting into an AI tool.
        </p>

        <ResumeDownloadButton />

        <nav
          aria-label="Resume sections"
          // These wrap to two rows on a phone; the 44px link height is what
          // keeps four destinations from blurring into one target.
          className="mt-10 flex flex-wrap gap-x-3 border-y border-line py-1.5 t-meta"
        >
          {[
            ["Summary", "#summary"],
            ["Experience", "#experience"],
            ["Education", "#education"],
            ["Skills", "#skills"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="-mx-1 flex min-h-[44px] touch-manipulation items-center px-1 text-text-faint no-underline transition-colors hover:text-accent"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Resume body matches public/resume.pdf (October 2026), in the site's
            sentence case. Every fact is checked against
            content/knowledge/resume.md by evals/resume.test.mjs. */}
        <div className="mt-8">
          <h2 className="font-mono t-meta text-text-soft">Toronto, ON</h2>
          <p className="mt-1 font-mono t-meta text-text-soft">
            613-795-9684 · hello@sidhantmathur.com · linkedin.com/in/sidhantmathur ·
            github.com/sidhantmathur · sidhantmathur.com
          </p>

          <div id="summary" className="mt-10 scroll-mt-20">
            <MonoLabel>Summary</MonoLabel>
            <p className="t-body mt-3 max-w-[72ch] text-text-soft">
              Sales operations specialist with 5 years at Nokia, owning the reporting and
              tooling for a 7-region, $10B+ pipeline sales organization: incentives,
              quarter-end close and weekly operating review. Co-founder and sole developer
              of A Darle 20, a marketplace with 2,100+ users. Builds with whatever the job
              needs, from Power BI and Salesforce to Next.js and Supabase.
            </p>
          </div>

          <div id="experience" className="mt-10 scroll-mt-20">
            <MonoLabel>Experience</MonoLabel>

            <div className="mt-4">
              <h3 className="t-head font-medium text-text">
                Nokia — Ottawa &amp; Toronto, ON (Remote){" "}
                <Link href="/projects/nokia" className="-my-2 ml-1 py-2 font-mono t-meta font-normal text-text-faint no-underline hover:text-accent">
                  case study →
                </Link>
              </h3>
              <p className="mt-3 font-mono t-meta text-text-soft">
                Sales operations specialist · Jun 2024 – Present
              </p>
              <ul className="t-body mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-text-soft marker:text-text-faint">
                <li>
                  Built the weekly operating review tool that regional sales ops teams use to
                  compile the Chief Customer Officer&apos;s weekly report, merging CRM data
                  with standardized self-serve updates in place of ad hoc email and slides;
                  shipped in two weeks.
                </li>
                <li>
                  Launched the self-serve Power App behind quarter-end executive reporting for
                  80+ stakeholders across 7 regions, replacing an error-prone, full-day manual
                  consolidation, so close reporting no longer waits on one analyst.
                </li>
                <li>
                  Inherited and extended the Power App and automations that North America
                  runs all its reviews on; 30 core users.
                </li>
                <li>
                  Run monthly and quarterly sales incentive calculations for 900+ staff; cut
                  steps and manual checks from the automation.
                </li>
                <li>
                  Delivered Salesforce CRM Analytics dashboards for exec reviews (150+ monthly
                  users), then moved reporting to Power BI.
                </li>
                <li>
                  Built Power BI reports for 5 teams outside the sales org and maintain the
                  automation that keeps them refreshed.
                </li>
                <li>
                  Building an AI agent (Power BI, Glean, Teams) that flags pipeline gaps vs.
                  prior years, conflicting fields and past-due dates.
                </li>
              </ul>

              <p className="mt-6 font-mono t-meta text-text-soft">
                Workforce management specialist · Oct 2021 – Jun 2024
              </p>
              <ul className="t-body mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-text-soft marker:text-text-faint">
                <li>
                  Ran the monthly headcount forecast process (~70% of budget), planning and
                  requisitions for a 3,000–4,000-person org.
                </li>
                <li>
                  Automated input checks for the monthly headcount forecast with VBA, saving
                  ~5 hours a week of manual review.
                </li>
                <li>
                  Inherited and ran the SharePoint home site for 3,000–4,000 people and helped
                  teams set up their own sites.
                </li>
                <li>
                  Led a lab and facility utilization analysis that identified $1.2M in
                  real-estate cost savings.
                </li>
              </ul>
            </div>

            <div className="mt-10">
              <h3 className="t-head font-medium text-text">
                A Darle 20 (&quot;Let&apos;s Go 20&quot;) — adarle20.com — Puebla, Mexico
                (Remote){" "}
                <Link href="/projects/adarle20" className="-my-2 ml-1 py-2 font-mono t-meta font-normal text-text-faint no-underline hover:text-accent">
                  case study →
                </Link>
              </h3>
              <p className="mt-3 font-mono t-meta text-text-soft">
                Co-founder &amp; CTO (part-time) · Aug 2025 – Present · launched Mar 2026
              </p>
              <p className="t-meta mt-2 max-w-[72ch] text-text-faint">
                Stack: Next.js, React, TypeScript, Supabase (PostgreSQL), Stripe Connect,
                Vercel, PostHog, Resend
              </p>
              <ul className="t-body mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-text-soft marker:text-text-faint">
                <li>
                  Built the platform as sole developer using AI-native workflows, owning
                  architecture, code review and release.
                </li>
                <li>
                  Reached 2,100+ users, 110+ hosts and 3,600+ session reservations from 1,000+
                  players.
                </li>
                <li>
                  Instrumented the funnel (conversion, refunds, host activation); data steered
                  growth to word of mouth over paid ads.
                </li>
                <li>
                  Ran the technology behind a flagship 251-player event at a 19,000-attendee
                  convention, rated 4.96/5 by attendees.
                </li>
              </ul>

              <figure className="mt-6 max-w-[72ch]">
                {/* At the screenshot's own proportions (1520×690). A 16:10
                    frame with object-cover cropped both sides, cutting the
                    first listing's title mid-word. */}
                <div className="border border-line">
                  <Image
                    src="/images/adarle20-listings.png"
                    alt="A Darle 20 session listings, showing hosted games players can reserve"
                    width={1520}
                    height={690}
                    sizes="(max-width: 768px) 100vw, 72ch"
                    className="block h-auto w-full"
                  />
                </div>
                <figcaption className="t-meta mt-2 max-w-[72ch] text-text-faint">
                  A Darle 20 — session listings. The Nokia work is internal tooling behind a
                  corporate login, so there is nothing to show from it here.
                </figcaption>
              </figure>
            </div>

            <div className="mt-10">
              <h3 className="t-head font-medium text-text">
                Freelance web development &amp; consulting — Remote
              </h3>
              <p className="mt-3 font-mono t-meta text-text-soft">
                Self-employed · May 2019 – Oct 2021
              </p>
              <ul className="t-body mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-text-soft marker:text-text-faint">
                <li>
                  Built client sites, including an affiliate-marketing site and consultation
                  booking for a fashion consultant&apos;s team.
                </li>
              </ul>
            </div>

            <div className="mt-10">
              <h3 className="t-head font-medium text-text">
                Immosis LLC — Dallas, TX (Remote)
              </h3>
              <p className="mt-3 font-mono t-meta text-text-soft">
                Digital marketing/web developer (part-time) · Mar 2018 – Aug 2018
              </p>
              <ul className="t-body mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-text-soft marker:text-text-faint">
                <li>
                  Developed the company&apos;s VR course platform: video playback, uploads,
                  user accounts and Stripe subscription payments.
                </li>
                <li>
                  Designed the data model and admin panel so the team could manage courses
                  without a developer.
                </li>
              </ul>
            </div>

            <div className="mt-10">
              <h3 className="t-head font-medium text-text">
                Dell Technologies — Round Rock, TX
              </h3>
              <p className="mt-3 font-mono t-meta text-text-soft">
                Marketing intern · May 2018 – Aug 2018
              </p>
              <ul className="t-body mt-3 max-w-[72ch] list-disc space-y-2 pl-5 text-text-soft marker:text-text-faint">
                <li>
                  Built an Azure ML propensity model that found ~20,000 cross-sell accounts
                  (~$129M at the segment&apos;s average deal size).
                </li>
                <li>
                  Trained the sales and marketing teams to use the model&apos;s output for lead
                  prioritization.
                </li>
              </ul>
            </div>
          </div>

          <div id="education" className="mt-10 scroll-mt-20">
            <MonoLabel>Education</MonoLabel>
            <ul className="mt-3 max-w-[72ch] list-disc space-y-2 pl-5 t-body text-text-soft">
              <li>
                B.S. in Business Administration — The University of Texas at Dallas,
                2016 – 2019. Placed 3rd of 150+ in a sales competition pitching to local
                sales managers.
              </li>
              <li>
                Software Engineering Immersive — General Assembly, Toronto, Sep 2020 – Jan
                2021
              </li>
            </ul>
          </div>

          <div id="skills" className="mt-10 scroll-mt-20">
            <MonoLabel>Skills</MonoLabel>
            <ul className="mt-3 max-w-[72ch] list-disc space-y-2 pl-5 t-body text-text-soft">
              <li>
                <strong className="text-text">RevOps systems &amp; analytics:</strong>{" "}
                Salesforce (CRM Analytics), Power BI, DAX, Power Apps / Power Automate,
                SharePoint, Excel/VBA
              </li>
              <li>
                <strong className="text-text">Sales operations:</strong>{" "}
                Sales compensation, forecasting, pipeline and quarter-end reporting, CRM data
                quality, process automation
              </li>
              <li>
                <strong className="text-text">AI:</strong>{" "}
                Claude Code, Codex, LLM APIs (Anthropic, OpenAI, OpenRouter), Glean, Copilot
                Studio
              </li>
              <li>
                <strong className="text-text">Software engineering:</strong>{" "}
                JavaScript, TypeScript, Python, SQL, React, Next.js, Node.js, PostgreSQL,
                Supabase, REST APIs, Git, HTML/CSS
              </li>
              <li>
                <strong className="text-text">Interests:</strong>{" "}
                building with AI, pickup basketball, classic and horror fiction, Canadian AI
                and housing policy
              </li>
            </ul>
            <p className="t-body mt-6 max-w-[72ch] text-text-soft">
              Canadian citizen
            </p>
          </div>
        </div>
      </DocPage>
  );
}
