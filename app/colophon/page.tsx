import type { Metadata } from "next";
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
      </DocPage>
  );
}
