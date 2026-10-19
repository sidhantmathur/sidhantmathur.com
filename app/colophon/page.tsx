import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/layout/doc-page";
import { COLOPHON_STACK } from "@/lib/site";

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
          Most of the code was written by AI agents working from a build
          spec; the decisions, copy, and mistakes are mine.
        </p>
        <p className="t-body mt-4 max-w-[58ch] text-text-soft">
          The assistant is tested against a fixed corpus, and what it scores is
          published rather than described.{" "}
          <Link href="/measurements" className="text-accent">
            See the measurements
          </Link>
          .
        </p>
        <h2 className="t-head mt-10 font-medium text-text">
          The site shows its workings
        </h2>
        <p className="t-body mt-4 max-w-[58ch] text-text-soft">
          One rule holds everything here together: anything the machine does,
          you can look at. The{" "}
          <Link href="/prompt" className="text-accent">
            instructions
          </Link>{" "}
          it runs on are published. What it{" "}
          <Link href="/refusals" className="text-accent">
            won&apos;t answer
          </Link>{" "}
          is a page, not a surprise. What each turn costs is printed next to
          the turn, and{" "}
          <Link href="/measurements" className="text-accent">
            how often it&apos;s right
          </Link>{" "}
          is measured in public. A chatbot asking for a hiring manager&apos;s
          trust should have to show its receipts.
        </p>
      </DocPage>
  );
}
