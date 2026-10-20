"use client";

import { useEffect, useRef, useState } from "react";

// Live token-arrival rate for the seismograph (docs/idea-decisions.md #5).
//
// An estimate from the growth of the streamed text, at four characters per
// token. The exact figure (`telemetry.timing.tokensPerSecond`, from the
// provider's usage numbers) arrives only when the turn ends, so the UI shows
// this one with a `≈` while streaming and the server's without one once the
// turn settles.

const SAMPLE_MS = 150;
/** Roughly seven seconds of history at the sample interval. */
const WINDOW = 48;
const CHARS_PER_TOKEN = 4;

export type TokenRate = {
  /** Newest last, one per SAMPLE_MS. Empty before the first turn. */
  samples: number[];
  /** The most recent sample, or null when nothing is streaming. */
  live: number | null;
  /** Highest sample in the current window — the sparkline's scale. */
  peak: number;
};

export function useTokenRate(text: string, isBusy: boolean): TokenRate {
  const [samples, setSamples] = useState<number[]>([]);
  const [live, setLive] = useState<number | null>(null);

  // The sampler reads the latest text without re-subscribing every token.
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    if (!isBusy) {
      // The trace stays on screen after the turn ends, but the readout stops
      // claiming a rate.
      queueMicrotask(() => setLive(null));
      return;
    }

    let lastLength = textRef.current.length;
    let lastAt = performance.now();
    // A fresh turn starts a fresh trace rather than continuing the last one.
    queueMicrotask(() => setSamples([]));

    const id = window.setInterval(() => {
      const now = performance.now();
      const length = textRef.current.length;
      const elapsed = (now - lastAt) / 1000;
      // Length can go down between turns, when the streamed message is replaced.
      const delta = Math.max(0, length - lastLength);
      lastLength = length;
      lastAt = now;
      const rate = elapsed > 0 ? delta / CHARS_PER_TOKEN / elapsed : 0;
      setSamples((prev) => [...prev, rate].slice(-WINDOW));
      setLive(rate);
    }, SAMPLE_MS);

    return () => window.clearInterval(id);
  }, [isBusy]);

  return { samples, live, peak: samples.length ? Math.max(...samples) : 0 };
}
