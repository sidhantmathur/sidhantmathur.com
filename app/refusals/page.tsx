import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/layout/doc-page";
import { REFUSALS, ENFORCEMENT_LABEL } from "@/lib/refusals";

// The refusal ledger (#10). The entries live in lib/refusals.ts with the file
// that enforces each one; this page renders them and adds the framing. The
// framing is the part that has to stay accurate: see the note on the refusal
// ledger in docs/copy-ledger.md.

export const metadata: Metadata = {
  alternates: { canonical: "/refusals" },
  title: "What this assistant won't do",
  description:
    "What the site's chat assistant won't do, why, what it does instead, and whether each rule is enforced by code or only asked of the model.",
};

export default function RefusalsPage() {
  return (
    <DocPage>
      <h1 className="t-title font-medium text-text">
        What this assistant won&apos;t do
      </h1>

      <p className="t-body mt-6 max-w-[62ch] text-text-soft">
        This page lists what the chat assistant won&apos;t do, why, and what it
        does instead.
      </p>
      <p className="t-body mt-4 max-w-[62ch] text-text-soft">
        The label beside each entry says how the rule is enforced. A rule in the
        prompt holds only while the model follows it, and a determined visitor
        may find a phrasing that gets around it. A rule in code holds whether
        the model follows it or not. One entry is an idea Sidhant decided
        against, so it was never built.
      </p>
      <p className="t-body mt-4 max-w-[62ch] text-text-soft">
        The path under each entry is the file that holds the rule, and a test
        checks that the rule is still there. You can read{" "}
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
              <span className="t-label shrink-0 text-text-faint">
                {ENFORCEMENT_LABEL[r.enforcedBy]}
              </span>
            </div>
            <p className="t-body mt-3 max-w-[62ch] text-text-soft">
              {r.why}
            </p>
            <p className="t-body mt-3 max-w-[62ch] text-text">
              <span className="text-text-faint">Instead: </span>
              {r.instead}
            </p>
            <p className="t-label mt-2 font-mono text-text-faint">{r.anchor.path}</p>
          </section>
        ))}
      </div>
    </DocPage>
  );
}
