import Link from "next/link";
import { HERO_TLDR, TLDR_FOOTER, TLDR_LABEL } from "@/content/recruiter";

// The recruiter TL;DR (#25, Track B — promoted by the front-door pass).
//
// A chat-first site fails the six-second scan: there is nothing on it to read
// until someone types. This is the answer to that. The front-door pass
// (2026-08-23) promoted it from a caption-sized readout to body type — the
// most important text on the page was the hardest to read on it — and set the
// values in the sans face: they are sentences to be read, not machinery, and
// the mono labels beside them keep the readout register.
//
// Constraints it lives under:
//
//   1. It renders in the EMPTY STATE ONLY. Once a conversation exists the
//      reader has asked a better question than this block answers, and leaving
//      it above the transcript would make it chrome. Asserted in
//      evals/track-b.test.mjs.
//   2. Every value is corpus text, not drafted prose (see content/recruiter.ts).
//      Nothing here may say something the model could not also say and cite.
//   3. It renders HERO_TLDR, not the full list — the `looking for` and `where`
//      rows live in the hero subline now, and repeating them four lines apart
//      would read as padding. The full six-row list stays exported and checked.
export function RecruiterTldr() {
  return (
    <section aria-label="Summary" className="max-w-[64ch] border-t border-line pt-4">
      <h2 className="t-label text-text-faint">{TLDR_LABEL}</h2>
      <dl className="mt-2 space-y-2 md:space-y-1.5">
        {HERO_TLDR.map((row) => (
          <div key={row.label} className="sm:flex sm:gap-4">
            <dt className="t-label shrink-0 pt-1 text-text-faint sm:w-[104px]">
              {row.label}
            </dt>
            <dd className="t-body text-text-soft [font-family:var(--font-geist-sans)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="t-meta mt-3 text-text-faint">
        <Link href="/resume" className="text-text-faint underline decoration-line-strong underline-offset-2 hover:text-accent">
          {TLDR_FOOTER}
        </Link>
      </p>
    </section>
  );
}
