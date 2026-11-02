"use client";

import { useEffect, useRef, useState } from "react";
import { textOf, type ChatMessage } from "./use-conversation";

// ---- What assistive tech is told ----------------------------------------
//
// Streamed prose can't go in a live region (a screen reader would read the
// answer over itself for the length of the turn), so each completed turn
// gets one polite announcement instead, and the answer is read once, when
// the reader navigates to it. The turn number makes each announcement a
// distinct string: a live region doesn't re-announce text identical to what
// it already holds.
//
// Failures don't come through here. TurnError carries role="alert", which
// interrupts rather than waits, as a turn that didn't happen should.
//
// The announcer element stays in AppShell, outside the shell and the print
// document (see the note there); this only decides what it says.
export function useTurnAnnouncement(
  messages: ChatMessage[],
  isBusy: boolean,
  errorKind: "none" | "error" | "rate_limited",
): string {
  const [announcement, setAnnouncement] = useState("");
  // Counted rather than edge-triggered: on a fast turn the whole answer can
  // arrive inside one render batch, leaving no true→false `isBusy` transition
  // to observe. Whenever the shell is idle with one more finished answer than
  // was last announced, that is the event. The mocked-stream check in
  // scripts/a11y-audit.mjs covers the fast case.
  const announcedCount = useRef(0);
  useEffect(() => {
    if (isBusy) return;
    const answered = messages.filter((m) => m.role === "assistant" && textOf(m)).length;
    // Fewer than before means the conversation was left or swapped, which is
    // not an answer and must not leave the counter high enough to swallow the
    // next one.
    if (answered <= announcedCount.current) {
      announcedCount.current = answered;
      return;
    }
    announcedCount.current = answered;
    // The error and rate-limit blocks announce themselves; an aborted turn was
    // the reader's own doing and renders nothing on purpose. errorKind is a
    // string union, so this has to compare with "none": a truthiness test
    // passes even when nothing has gone wrong.
    if (errorKind !== "none") return;
    queueMicrotask(() => setAnnouncement(`Answer ${answered} complete.`));
  }, [isBusy, errorKind, messages]);
  return announcement;
}
