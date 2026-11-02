"use client";

import { EmailCopy, LinkedInButton, ResumePdfButton } from "@/components/contact-actions";

// Says three things, all checkable in this repo: this is a replay, it was
// rebuilt from the link rather than fetched from a server, and it stopped
// being live when it was made.
const REPLAY_BANNER =
  "Replayed conversation, rebuilt from the link you opened. The site stored nothing. This is a snapshot of what the model said at the time, not a live session.";
// A fit check is sent to people who have never seen the site
// (docs/application-links.md), so a replayed one says what it is first. Both
// claims are enforced by lib/role-fit.ts: a match without a source is
// downgraded, and gaps can't be empty while a row is unmet.
const REPLAY_FIT_LINE =
  "A fit check: the assistant on Sidhant Mathur's site read one job posting against his record, citing a source for every match and listing the gaps.";
// Only when the posting really was left out, as it is in every link
// lib/transcript.ts (toSnapshot) builds now; older links carry it.
const REPLAY_POSTING_LEFT_OUT =
  "The link leaves out the posting. Each requirement in the table is quoted from it.";

// A replay says so once, at the top, so it can't be mistaken for a live
// session. It's also a standalone page sent to people who have never seen the
// site, so it carries the same three contact actions as the front door.
export function ReplayBanner({
  replayedFit,
  postingLeftOut,
  onHome,
}: {
  /** The replay carries a fit check. Read off the decoded conversation. */
  replayedFit: boolean;
  /** And the posting itself was left out of the link. */
  postingLeftOut: boolean;
  /** The front door; see goHome in app-shell.tsx. */
  onHome: () => void;
}) {
  return (
    <div className="mb-6 space-y-3 border-l-2 border-accent bg-raised px-3 py-3">
      {replayedFit && (
        <p className="t-body text-text [font-family:var(--font-geist-sans)]">
          {REPLAY_FIT_LINE}
        </p>
      )}
      <p className="t-meta text-text-soft">
        {REPLAY_BANNER}
        {postingLeftOut && ` ${REPLAY_POSTING_LEFT_OUT}`}
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        <ResumePdfButton surface="replay" primary={replayedFit} />
        <EmailCopy surface="replay" />
        <LinkedInButton surface="replay" />
      </div>
      <button
        type="button"
        onClick={onHome}
        data-js-control
        className="t-label flex min-h-[44px] touch-manipulation items-center text-text-faint hover:text-accent"
      >
        start a new conversation
      </button>
    </div>
  );
}
