import Link from "next/link";

// ResumeCard (04 §2.2). The Sans body line is verbatim from site-copy.md's
// resume-page body, including the visible `[TODO: month year]` marker (copy
// gaps stay visible — never invented). Renders both links; when the PDF isn't
// available yet, a mono --faint note flags it rather than hiding the link.
//
// Shape matches the showResume tool's execute() return value.
export type ResumeCardData = {
  htmlHref: string;
  pdfHref: string;
  pdfAvailable: boolean;
};

export function ResumeCard({ data }: { data: ResumeCardData }) {
  return (
    <div className="border border-ink bg-paper p-5">
      <span className="font-mono text-xs text-muted">Resume</span>
      <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
        The current version, last updated [TODO: month year]. A plain-text
        version lives at /resume.md if you&apos;d rather feed it to an AI — I
        won&apos;t take it personally.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs">
        <Link
          href={data.htmlHref}
          className="text-ink no-underline hover:underline"
        >
          View resume →
        </Link>
        <a
          href={data.pdfHref}
          className="text-ink no-underline hover:underline"
        >
          Download PDF ↗
        </a>
        {!data.pdfAvailable && (
          <span className="text-muted">
            (PDF pending — HTML version above is current)
          </span>
        )}
      </div>
    </div>
  );
}
