"use client";

import { formatActivity } from "@/lib/turn-phase";
import { usePhaseActivity } from "./phase-activity";
import { formatElapsed } from "./use-elapsed";

// The turn-in-flight indicator: one line under the conversation, never
// clickable or expandable. It names the step, not the wait (see the header of
// lib/turn-phase.ts). Four pieces:
//
//   a grid     nine accent cells blinking on a stagger, the header's
//              accent-while-streaming status dot at the column's scale
//   a sweep    the step name under a gradient scan
//   a readout  what the stream is doing inside the step (activityOf in
//              lib/turn-phase.ts): `thinking` while a reasoning part is open,
//              `6/14` while the assessment's rows arrive
//   a count    the elapsed time, monospace and tabular
//
// Only the step is announced. The grid is decorative, and the readout and the
// count are aria-hidden: a counter announced on every change is noise.

const PIXELS = 9;
// A diagonal stagger rather than a left-to-right wipe, which beside the sweep
// would read as one wide animation with a gap in the middle.
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
      {/* The tighter gap keeps "checking the fit… thinking 9.0s stop" on one
          line at 375px (see lib/turn-phase.ts). */}
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
