"use client";

import Link from "next/link";

// What the visitor sees if the client throws. Controls that need JavaScript
// stay disabled until hydration sets `data-hydrated`, so without this a failed
// hydration leaves an inert page that looks like it is still loading.
//
// "Try again" re-renders, which often clears a hydration mismatch caused by an
// extension or a half-applied cache. The resume link always works because it
// is a plain document and doesn't need the client that just broke.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex h-dvh flex-col items-start justify-center gap-4 bg-bg px-6 [font-family:var(--font-geist-mono)] md:px-12">
      <p className="t-body max-w-[54ch] text-text-soft">
        Something broke in the browser and the conversation didn&apos;t start.
        That&apos;s a bug on my end.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="t-meta inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2 text-text-soft transition-colors hover:border-accent hover:text-accent"
        >
          Try again
        </button>
        <Link
          href="/resume"
          className="t-meta inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2 text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
        >
          Read the resume instead →
        </Link>
      </div>
    </div>
  );
}
