"use client";

import Link from "next/link";

// What the visitor sees if the client throws.
//
// This exists because of a hole the pre-hydration work opened and then had to
// close. Every control that needs JavaScript is now disabled until hydration
// finishes and the shell sets `data-hydrated` — which is the honest state right
// up until hydration never finishes, at which point the page sits there
// permanently inert with a composer that says "Loading the conversation…" and
// means it forever. That is better than the silent version it replaced, and it
// is still a page pretending to be busy when it has actually stopped.
//
// So the failure gets a face and a way out. Same register as app/not-found.tsx,
// which is the other page on this site whose whole job is to be honest about
// something not being there.
//
// The reset button is the cheap fix that usually works — a re-render often
// clears a hydration mismatch caused by an extension or a half-applied cache —
// and the resume link is the one that always works, because it is a document
// rather than an application. On a page whose argument is that it degrades
// honestly, the fallback should not itself need the thing that just broke.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex h-dvh flex-col items-start justify-center gap-4 bg-bg px-6 [font-family:var(--font-geist-mono)] md:px-12">
      <p className="t-body max-w-[54ch] text-text-soft">
        Something broke in the browser and the conversation didn&apos;t start. That one
        is on me, not you.
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
