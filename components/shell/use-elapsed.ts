"use client";

import { useEffect, useState } from "react";

// How long the turn in flight has been in flight, in tenths of a second.
//
// This is the one readout the beautiful-ui exploration had that this site
// didn't, and it is the one that most obviously belonged here: a site whose
// whole argument is that it measures itself showed nothing at all during the
// single longest wait it ever asks a visitor to sit through — the gap between
// pressing enter and the first token. The status strip's `ttft` only fills in
// once that gap is over, which is precisely too late to be reassuring.
//
// Sampled on an interval rather than per animation frame. The display has one
// decimal place, so 100ms is already twice the resolution anything can show,
// and a rAF loop would wake the main thread sixty times a second to render a
// digit that changes six times a second — during the exact window the browser
// is busy parsing a stream.

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
    // The start is a closure variable, not state and not a ref: it is written
    // once when the subscription opens and read only by the callback below.
    // Nothing about it is ever needed during a render.
    const start = performance.now();
    const id = window.setInterval(
      () => setElapsed((performance.now() - start) / 1000),
      TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [running]);

  // Gated on `running` rather than cleared on the falling edge, which would
  // mean a setState in the effect body — a cascading render, and the thing the
  // React compiler correctly refuses.
  //
  // An earlier draft held the last duration on screen after the turn settled,
  // by analogy with the seismograph keeping its trace. That was pointless here:
  // the only caller renders this beside the phase line, and phaseOf returns
  // null the moment prose exists, so the whole indicator has already unmounted
  // by the time there is a final number to hold.
  //
  // One consequence worth naming: for the first tick of a new turn this is the
  // previous turn's reading, since the interval writes at 100ms rather than at
  // 0. A tenth of a second, on a counter whose last digit is already moving.
  return running ? elapsed : null;
}

/** `1.7` → `1.7s`. One decimal, always, so the digit doesn't jitter in width. */
export function formatElapsed(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}
