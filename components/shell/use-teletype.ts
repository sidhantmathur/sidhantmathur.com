"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Teletype audio (docs/idea-decisions.md #16): a soft tick as tokens arrive,
// pitch-mapped to the arrival rate, synthesized with Web Audio.
//
// Off by default, and the AudioContext isn't constructed until the toggle is
// switched on; browsers start a context created outside a user gesture
// suspended anyway. The preference persists, but is restored after mount so
// the server render and the first client render agree.

const STORAGE_KEY = "teletype.v1";

/** Minimum gap between ticks. Faster than this stops reading as a teletype. */
const MIN_TICK_MS = 45;
const VOLUME = 0.035;

export function useTeletype(text: string, isBusy: boolean) {
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const lastTickRef = useRef(0);
  const lastLengthRef = useRef(0);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "on") {
        queueMicrotask(() => setEnabled(true));
      }
    } catch {
      /* private mode — stays off, which is the safe direction */
    }
  }, []);

  const tick = useCallback((charsPerTick: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Faster arrival rides higher, so the ear hears the same shape the
    // seismograph draws. Clamped either side of a comfortable band.
    osc.type = "square";
    osc.frequency.value = Math.min(1900, Math.max(700, 700 + charsPerTick * 12));
    // A near-instant attack and a ~30ms decay: a mechanical click, not a note.
    gain.gain.setValueAtTime(VOLUME, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((was) => {
      const next = !was;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {
        /* persistence is a nicety */
      }
      if (next && !ctxRef.current) {
        // Constructed inside the click handler, the gesture browsers require.
        // The confirming tick below shows it works when switched on between
        // turns.
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor) ctxRef.current = new Ctor();
      }
      if (next) queueMicrotask(() => tick(20));
      return next;
    });
  }, [tick]);

  // Driven by text length rather than a timer, so the sound tracks actual
  // chunk arrival, gaps included.
  useEffect(() => {
    if (!enabled || !isBusy) {
      lastLengthRef.current = text.length;
      return;
    }
    const delta = text.length - lastLengthRef.current;
    lastLengthRef.current = text.length;
    if (delta <= 0) return;
    const now = performance.now();
    if (now - lastTickRef.current < MIN_TICK_MS) return;
    lastTickRef.current = now;
    tick(delta);
  }, [text, enabled, isBusy, tick]);

  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return { teletype: enabled, toggleTeletype: toggle };
}
