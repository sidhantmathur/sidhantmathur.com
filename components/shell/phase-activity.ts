"use client";

import { useSyncExternalStore } from "react";
import { sameActivity, type PhaseActivity } from "@/lib/turn-phase";

// The phase line's readout, carried from the conversation hook to the line
// without passing through the shell that renders both.
//
// A store rather than a prop: the shell renders `<PhaseLine key={phase}>`,
// keyed by the step string so a new step replays the line's entry, and the
// readout, which changes with every row of an assessment, can't ride in that
// key. One more prop from the shell would also work; until the shell takes it,
// the hook publishes here and the line subscribes. One conversation per page,
// so one value. Published only when the reading changes (`sameActivity`), so
// tool-input deltas that add no row re-render nothing.

let current: PhaseActivity | null = null;
const listeners = new Set<() => void>();

export function publishPhaseActivity(next: PhaseActivity | null): void {
  if (sameActivity(current, next)) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current readout, or null. Always null on the server. */
export function usePhaseActivity(): PhaseActivity | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
