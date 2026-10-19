"use client";

import { useSyncExternalStore } from "react";
import { sameActivity, type PhaseActivity } from "@/lib/turn-phase";

// The phase line's readout, carried from the conversation hook to the line
// without passing through the shell that renders both.
//
// Why a store and not a prop: the shell renders `<PhaseLine key={phase} …>`,
// keyed by the step string on purpose (a new step replays the line's entry).
// The readout changes every row of an assessment, so it cannot ride in that
// string, and the shell passes the line nothing else. The plain fix is one
// more prop from the shell; until the shell takes it, the hook publishes here
// and the line subscribes. One conversation per page, so one value.
//
// Published only when the reading changes (`sameActivity`), so a stream
// of tool-input deltas that adds no row re-renders nothing.

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
