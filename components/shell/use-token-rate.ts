"use client";

import { useEffect, useRef, useState } from "react";

// Live token-arrival rate for the seismograph (roadmap Sprint 2, #5).
//
// WHY THIS IS AN ESTIMATE, AND WHY THAT'S FINE. The server measures the real
// figure and F1 already delivers it — `telemetry.timing.tokensPerSecond`, exact,
// computed from the provider's own usage numbers. But it arrives once, at the
// end of the turn, and a needle that only moves after the answer has finished
// is not an instrument.
//
// So there are two numbers, and the UI shows both: this one, sampled from the
// growth of the streamed text while it streams, marked with a `≈`; and the
// server's, shown without one as soon as the turn settles. Anything else would
// be dressing a guess up as a measurement, on a site whose whole argument is
// that it doesn't do that.
//
// Four characters per token is the usual English rule of thumb. It is wrong in
// both directions on code and on names, which is exactly why it renders as `≈`.

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
      // The trace is left on screen after the turn ends — a flatline that
      // vanishes teaches nothing — but the readout stops claiming a rate.
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
      // Length can go DOWN between turns, when the streamed message is replaced.
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
