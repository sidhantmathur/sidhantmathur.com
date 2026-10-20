import Link from "next/link";

// Carries its own full-height wrapper because the root body is overflow-hidden.
// The resume link sits beside the way home: a 404 here is usually a mistyped or
// outdated link, and the reader it strands most likely came for the resume.
export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-start justify-center gap-4 bg-bg px-6 [font-family:var(--font-geist-mono)] md:px-12">
      <p className="t-body text-text-soft">There&apos;s nothing at this address.</p>
      <div className="flex flex-wrap gap-2.5">
        <Link
          href="/"
          className="t-meta inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2 text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
        >
          Go to the homepage →
        </Link>
        <Link
          href="/resume"
          className="t-meta inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2 text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
        >
          Read the resume →
        </Link>
      </div>
    </div>
  );
}
