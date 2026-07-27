import Link from "next/link";
import { RECRUITER_TLDR, TLDR_FOOTER, TLDR_LABEL } from "@/content/recruiter";

// The recruiter TL;DR (#25, Track B).
//
// A chat-first site fails the six-second scan: there is nothing on it to read
// until someone types. This is the answer to that, and it is deliberately the
// least conversational thing on the page — labels and facts, in the same mono
// register as the status strip, so it reads as a readout rather than as a
// pitch.
//
// Three constraints it lives under:
//
//   1. It renders in the EMPTY STATE ONLY. Once a conversation exists the
//      reader has asked a better question than this block answers, and leaving
//      it above the transcript would make it chrome. It has done its job.
//   2. Every value is corpus text, not drafted prose (see content/recruiter.ts).
//      Nothing here may say something the model could not also say and cite.
//   3. It sits ABOVE the chips and BELOW the hero, so the scan order is
//      positioning → facts → the question you can ask. Moving it under the
//      chips puts the facts below the fold on a phone, which is the one place
//      this block has to work.
export function RecruiterTldr() {
  return (
    <section aria-label="Summary" className="max-w-[62ch] border-l-2 border-line-strong pl-3">
      <h2 className="text-[11px] text-text-faint">{TLDR_LABEL}</h2>
      <dl className="mt-2 space-y-1.5">
        {RECRUITER_TLDR.map((row) => (
          <div key={row.label} className="sm:flex sm:gap-3">
            <dt className="shrink-0 text-[11px] leading-[1.6] text-text-faint sm:w-[92px]">
              {row.label}
            </dt>
            <dd className="text-[12px] leading-[1.6] text-text-soft">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] leading-[1.6] text-text-faint">
        <Link href="/resume" className="text-text-faint underline decoration-line-strong underline-offset-2 hover:text-accent">
          {TLDR_FOOTER}
        </Link>
      </p>
    </section>
  );
}
