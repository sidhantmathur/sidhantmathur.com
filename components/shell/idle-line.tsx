"use client";

import { useEffect, useState } from "react";
import { IDLE_LINES } from "./shell-data";

/**
 * Which idle line is showing. Advances every 14 seconds while idle and holds
 * its place between idle spells, so the next spell picks up where the last
 * one stopped. Lives in the shell's render, not in IdleLine, which unmounts.
 */
export function useIdleLine(idle: boolean): { line: string; index: number } {
  const [idleIndex, setIdleIndex] = useState(0);
  useEffect(() => {
    if (!idle) return;
    const id = window.setInterval(
      () => setIdleIndex((i) => (i + 1) % IDLE_LINES.length),
      14_000,
    );
    return () => window.clearInterval(id);
  }, [idle]);
  return { line: IDLE_LINES[idleIndex]!, index: idleIndex };
}

// The idle one-liner fades in rather than typing itself out: one ambient motion
// at a time, and the backdrop wave is it. The caret is punctuation and doesn't
// pulse. The quietest thing on the page, below the conversation.
export function IdleLine({ line }: { line: string }) {
  return (
    <p className="t-meta animate-idle-line pt-6 text-text-faint">
      {line}
      <span className="text-accent">▍</span>
    </p>
  );
}
