import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/layout/doc-page";
import { COLOPHON_STACK } from "@/lib/site";
import { WHY_CHATBOT, WHY_CHATBOT_HEADING } from "@/components/shell/shell-data";

export const metadata: Metadata = {
  alternates: { canonical: "/colophon" },
  title: "How this site was built",
  description:
    "Next.js, TypeScript, and Tailwind, deployed on Vercel. Type is Geist Sans and Geist Mono.",
};

export default function ColophonPage() {
  return (
    <DocPage>
        <h1 className="t-title font-medium text-text">
          How this site was built
        </h1>
        <p className="t-body mt-6 max-w-[58ch] text-text-soft">{COLOPHON_STACK}</p>
        {/* The sentence that pointed at the source on GitHub is gone, marker
            and all. The repo is public and so is docs/, so whether to link it
            is Sidhant's decision, logged in the copy ledger; until then the
            page doesn't half-make the offer. */}
        <p className="t-body mt-4 max-w-[58ch] text-text-soft">
          Most of the code was written by AI agents working from a build spec.
          I made the decisions.
        </p>
        <p className="t-body mt-4 max-w-[58ch] text-text-soft">
          The assistant is tested against a fixed set of questions, and the
          results are published on the{" "}
          <Link href="/measurements" className="text-accent">
            measurements page
          </Link>
          .
        </p>
        <h2 className="t-head mt-10 font-medium text-text">
          Where to see how the assistant works
        </h2>
        <p className="t-body mt-4 max-w-[58ch] text-text-soft">
          The{" "}
          <Link href="/prompt" className="text-accent">
            instructions
          </Link>{" "}
          the assistant runs on are published in full, and so is a list of
          what it{" "}
          <Link href="/refusals" className="text-accent">
            won&apos;t answer
          </Link>
          , with the reason for each. In the chat, the top bar shows what the
          last answer cost, and the technical details panel lists the cost of
          every turn. The{" "}
          <Link href="/measurements" className="text-accent">
            eval results
          </Link>{" "}
          show how it scores.
        </p>
        {/* Folded in from the index's "Why this site is a chatbot" panel in
            wave 2. The front door is portfolio-first now, so the argument
            for the chat belongs here, with the rest of how the site works,
            rather than one tap from the resume. */}
        <h2 className="t-head mt-10 font-medium text-text">{WHY_CHATBOT_HEADING}</h2>
        {WHY_CHATBOT.map((para, i) => (
          <p key={i} className="t-body mt-4 max-w-[58ch] text-text-soft">
            {para}
          </p>
        ))}
      </DocPage>
  );
}
