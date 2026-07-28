import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/layout/doc-page";

export const metadata: Metadata = {
  alternates: { canonical: "/colophon" },
  title: "How this site was built",
  description:
    "Next.js, TypeScript, and Tailwind, deployed on Vercel. Type is Geist Sans and Geist Mono.",
};

export default function ColophonPage() {
  return (
    <DocPage>
        <h1 className="text-[24px] font-medium tracking-[-0.02em] text-text">
          How this site was built
        </h1>
        <p className="mt-6 max-w-[58ch] text-[15px] leading-relaxed text-text-soft md:text-base">
          Next.js, TypeScript, and Tailwind, deployed on Vercel. Type is Geist
          Sans and Geist Mono. The chat assistant runs on Claude through
          Vercel&apos;s AI Gateway, with the knowledge base injected directly
          into the prompt — at this scale, a vector database would be
          complexity for its own sake, so there isn&apos;t one.
        </p>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-text-soft md:text-base">
          Most of the code was written by AI agents working from a build
          spec; the decisions, copy, and mistakes are mine. The spec, design
          brief, and source are on GitHub.{" "}
          <span className="font-mono text-text-faint">
            [TODO: confirm repo is public before linking]
          </span>
        </p>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-text-soft md:text-base">
          The assistant is tested against a fixed corpus, and what it scores is
          published rather than described.{" "}
          <Link href="/measurements" className="text-accent">
            See the measurements
          </Link>
          .
        </p>
        <h2 className="mt-10 text-[17px] font-medium tracking-[-0.01em] text-text">
          The site shows its workings
        </h2>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-text-soft md:text-base">
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
