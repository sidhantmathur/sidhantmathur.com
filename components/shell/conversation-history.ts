"use client";

import { useEffect } from "react";

// Which side of the front door a history entry belongs to.
//
// The shell is one route, so without this the browser has no idea a
// conversation is a place: Back from a conversation left the site, and a
// phone's back gesture is the first thing a visitor tries to get out of a
// mode. Each entry carries `shell: "chat"` or nothing, which reads as the
// front door. Entering a conversation pushes a chat entry, Home pushes a
// front-door one, and popstate moves between them.
//
// The marker survives Next's own history writes: the App Router merges its
// internals into whatever state a pushState is given, and a back/forward
// traversal keeps the custom state it finds (preserveCustomHistoryState). A
// Next navigation to a new route writes a fresh entry with no marker, which
// is the front door, as it should be.

type ShellState = { shell?: "chat" | "home" } | null;

/** Whether the entry the browser is on belongs to a conversation. */
export function isChatEntry(state: unknown = window.history.state): boolean {
  return (state as ShellState)?.shell === "chat";
}

/**
 * The marker for a new entry written while the shell is up, so a panel opened
 * inside a conversation is still inside it when Back returns to it.
 */
export function carriedState(): ShellState {
  const shell = (window.history.state as ShellState)?.shell;
  return shell ? { shell } : null;
}

/** A conversation has just appeared from the front door: Back now returns there. */
export function pushChatEntry() {
  if (isChatEntry()) return;
  window.history.pushState({ shell: "chat" }, "", window.location.href);
}

/**
 * The visitor asked for the front door. The panel's path and a permalink's
 * fragment both belong to the conversation being left, so neither survives;
 * the query does, because it carries an application link's `?ref=`
 * (lib/analytics.ts).
 */
export function pushHomeEntry() {
  window.history.pushState({ shell: "home" }, "", "/" + window.location.search);
}

/**
 * Relabels the current entry without adding one: a reload lands on the front
 * door, so an entry that said "chat" before it no longer does, and a replayed
 * link opens as a conversation without a front door behind it.
 */
export function markEntry(shell: "chat" | "home") {
  window.history.replaceState({ shell }, "", window.location.href);
}

/**
 * Back and Forward across the front door. `leave` and `resume` must not write
 * history themselves: the browser has already moved.
 */
export function useConversationHistory({
  inConversation,
  canResume,
  leave,
  resume,
}: {
  inConversation: boolean;
  canResume: boolean;
  leave: () => void;
  resume: () => void;
}) {
  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const chat = isChatEntry(e.state);
      if (inConversation && !chat) leave();
      else if (!inConversation && chat && canResume) resume();
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [inConversation, canResume, leave, resume]);
}
