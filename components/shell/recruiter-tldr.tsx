import Link from "next/link";
import {
  CASE_CARDS,
  CASE_CARDS_LABEL,
  HERO_TLDR,
  TLDR_FOOTER,
  TLDR_LABEL,
} from "@/content/recruiter";

// The recruiter TL;DR (docs/idea-decisions.md #25): the facts a recruiter scans
// for in the first few seconds, readable before anyone types. Values are set in
// the sans face because they are sentences; the mono labels keep the readout
// register.
//
//   1. Empty state only. Once a conversation exists it would be chrome above
//      the transcript. Asserted in evals/track-b.test.mjs.
//   2. Every value is corpus text, not drafted prose (see content/recruiter.ts):
//      nothing the model couldn't also say and cite.
//   3. It renders HERO_TLDR, not the full six-row RECRUITER_TLDR: the `looking
//      for` and `where` rows are in the hero subline already.
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

// The case-study cards under the TL;DR: one number each, the title over it, and
// one link out. The whole card isn't the link because a card-sized anchor reads
// every word as the link's name; the sr-only title tells the two "Read the case
// study" links apart.
export function CaseCards() {
  return (
    <section aria-label="Case studies" className="max-w-[64ch]">
      <h2 className="t-label text-text-faint">{CASE_CARDS_LABEL}</h2>
      <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
        {CASE_CARDS.map((card) => (
          <article key={card.slug} className="flex flex-col border border-line-strong bg-bg/60 p-4">
            <h3 className="t-meta text-text">{card.title}</h3>
            <p className="mt-2 [font-family:var(--font-geist-sans)]">
              <span className="block text-[32px] font-semibold leading-none tracking-tight text-text">
                {card.stat}
              </span>
              <span className="mt-1.5 block text-[15px] leading-snug text-text-soft">
                {card.statLabel}
              </span>
            </p>
            <Link
              href={card.href}
              className="t-meta mt-auto flex min-h-[44px] items-end pt-3 text-text-soft no-underline transition-colors hover:text-accent"
            >
              Read the case study →<span className="sr-only">: {card.title}</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
