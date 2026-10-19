"use client";

import { formatActivity } from "@/lib/turn-phase";
import { usePhaseActivity } from "./phase-activity";
import { formatElapsed } from "./use-elapsed";

// The turn-in-flight indicator (replaces the bare `animate-pulse` paragraph
// that used to sit under the conversation).
//
// It says the same thing it always said — the STEP, not the wait; see the long
// note at the top of lib/turn-phase.ts, which this does not change — but
// it now says it in the three registers this site already speaks in:
//
//   a grid   nine square cells blinking on a stagger, in the accent. The
//            header's status dot is already accent-while-streaming, so this is
//            that same signal at the size the message column can carry.
//   a sweep  the step name under a gradient scan, instead of a whole-line
//            opacity throb. A throb is the generic "loading" gesture; a sweep
//            reads as something being passed over, which is what is happening.
//   a number the elapsed count, monospace and tabular. This is an instrument
//            log — the wait is data, and it was the one measurement the site
//            took and never showed.
//
// Still one line, still under the conversation, still never an expandable
// trace. The instrumentation policy's line about density living AROUND the
// conversation is untouched: nothing here opens, and nothing here is clickable.
//
// A fourth piece, between the step and the count (2026-10-19): what the stream
// is doing inside the step, when that is something the page can't otherwise
// show. `thinking` while a reasoning part is open, which on GPT-6 Luna is a
// stretch with no visible output at all, and `6/14` while the assessment's
// rows arrive. It is read off the stream like the step is (activityOf in
// lib/turn-phase.ts), and it is marked aria-hidden for the same reason the
// timer is: a counter announced every row is noise, and the step name is
// already the announcement.

const PIXELS = 9;
// A diagonal-ish stagger rather than a left-to-right wipe — reading order is
// already carried by the sweep beside it, and two synchronised left-to-rights
// would look like one wide animation with a gap in the middle.
const DELAYS = [90, 180, 270, 0, 90, 180, 90, 180, 270];

export function PhaseLine({
  phase,
  elapsed,
}: {
  phase: string;
  /** Seconds in flight, or null before the first sample lands. */
  elapsed: number | null;
}) {
  const activity = usePhaseActivity();
  return (
    <p
      // aria-live is on the wrapper so a screen reader hears the step name and
      // nothing else: the grid is decorative and the timer is marked aria-hidden
      // below, because a counter announced ten times a second is not progress,
      // it is a denial of service on the announcement queue.
      aria-live="polite"
      className="flex items-center gap-2.5 text-[15px]"
    >
      <span aria-hidden className="grid shrink-0 grid-cols-3 gap-px">
        {Array.from({ length: PIXELS }, (_, i) => (
          <span
            key={i}
            className="pixel-on block h-[4px] w-[4px] bg-accent"
            style={{ animationDelay: `${DELAYS[i]}ms` }}
          />
        ))}
      </span>
      <span className="shimmer-text">{phase}</span>
      {/* The readout and the count, as one cluster with a tighter gap: they are
          both measurements, and the 4px saved is what keeps "checking the fit…
          thinking 9.0s stop" on one line at 375px (see lib/turn-phase.ts). */}
      {(activity || elapsed != null) && (
        <span
          aria-hidden
          className="flex shrink-0 items-center gap-1.5 tabular-nums text-[13px] [font-family:var(--font-geist-mono)]"
        >
          {activity && <span className="text-text-soft">{formatActivity(activity)}</span>}
          {elapsed != null && <span className="text-text-faint">{formatElapsed(elapsed)}</span>}
        </span>
      )}
    </p>
  );
}
