import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/layout/doc-page";
import { REFUSALS, ENFORCEMENT_LABEL } from "@/lib/refusals";

// The refusal ledger (roadmap Sprint 7, #10).
//
// Hand-curated content. The entries live in lib/refusals.ts with the file that
// enforces each one; this page renders them and adds the framing. The framing
// is the part that has to stay honest — see the note in the copy ledger.

export const metadata: Metadata = {
  alternates: { canonical: "/refusals" },
  title: "What this assistant won't do",
  description:
    "Every refusal the site enforces, why it exists, what happens instead, and whether it is enforced by code or asked of the model.",
};

export default function RefusalsPage() {
  return (
    <DocPage>
      <h1 className="text-[24px] font-medium tracking-[-0.02em] text-text">
        What this assistant won&apos;t do
      </h1>

      <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-text-soft md:text-base">
        Most of the interesting decisions in a system like this are decisions
        about what it will not say. They are usually invisible — you only meet
        one by asking for something and being told no, and by then it looks like
        a limitation rather than a choice. So here they are as a list, with the
        file that holds each one.
      </p>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-text-soft md:text-base">
        The last column is the one worth reading. A refusal written into the
        prompt is a request: it holds because the model cooperates with it, and
        a determined visitor may eventually find a phrasing that gets around it.
        A refusal written into the code holds whether the model cooperates or
        not. Both are listed, and they are not labelled the same, because
        pretending a request is a guarantee is the kind of claim this site tries
        not to make.
      </p>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-text-soft md:text-base">
        Nothing here is a new rule written for this page. Each one already ran
        before it was listed — you can read{" "}
        <Link href="/prompt" className="text-accent">
          the prompt
        </Link>{" "}
        for the ones the model is asked to keep.
      </p>

      <div className="mt-10 space-y-8">
        {REFUSALS.map((r) => (
          <section key={r.id} className="border-t border-line pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="max-w-[48ch] text-[16px] font-medium leading-snug text-text">
                {r.title}
              </h2>
              <span className="shrink-0 text-[11px] text-text-faint">
                {ENFORCEMENT_LABEL[r.enforcedBy]}
              </span>
            </div>
            <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-text-soft">
              {r.why}
            </p>
            <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-text">
              <span className="text-text-faint">Instead: </span>
              {r.instead}
            </p>
            <p className="mt-2 font-mono text-[11px] text-text-faint">{r.anchor.path}</p>
          </section>
        ))}
      </div>
    </DocPage>
  );
}
