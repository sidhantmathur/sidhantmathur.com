"use client";

import { useEffect, useState } from "react";

// How long the turn in flight has been in flight, shown on the phase line while
// the visitor waits for the answer to start.
//
// Sampled every 100ms rather than per animation frame: the display has one
// decimal place, and a rAF loop would wake the main thread sixty times a second
// while the browser is busy parsing the stream.

const TICK_MS = 100;

/**
 * Seconds since `running` last went true, to one decimal. Returns null when
 * nothing is in flight, so a caller can render the counter and its absence
 * from the same expression.
 */
export function useElapsed(running: boolean): number | null {
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    const id = window.setInterval(
      () => setElapsed((performance.now() - start) / 1000),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [running]);

  // Gated on `running` rather than cleared on the falling edge, which would
  // need a setState in the effect body. So for the first tick of a new turn
  // this is the previous turn's reading.
  return running ? elapsed : null;
}

/** `1.7` → `1.7s`. One decimal, always, so the digit doesn't jitter in width. */
export function formatElapsed(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}
