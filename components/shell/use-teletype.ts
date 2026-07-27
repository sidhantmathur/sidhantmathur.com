"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Teletype audio (roadmap Sprint 2, #16) — a soft tick as tokens arrive,
// pitch-mapped to the arrival rate. Synthesized with Web Audio: no audio files,
// no dependency, nothing added to the bundle but this file.
//
// OFF BY DEFAULT, and that is a hard requirement rather than a preference: a
// page that makes noise on its own is the single most hostile thing a portfolio
// can do. The AudioContext is not even constructed until the toggle is switched
// on, which also happens to be what browsers require — a context created
// outside a user gesture starts suspended and stays silent anyway.
//
// The preference persists, so someone who turned it on doesn't have to keep
// turning it on. It still starts `false` on the server and on the first client
// render — restoring it after mount rather than during render is the same
// hydration rule the rest of the shell follows.

const STORAGE_KEY = "teletype.v1";

/** Ticks per second ceiling. Faster than this stops reading as a teletype. */
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
        // Constructed inside the click handler, which is the gesture browsers
        // want. A single confirming tick doubles as proof it works — otherwise
        // switching it on between turns appears to do nothing.
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctor) ctxRef.current = new Ctor();
      }
      if (next) queueMicrotask(() => tick(20));
      return next;
    });
  }, [tick]);

  // The ticker itself. Driven by text length rather than by a timer, so the
  // sound tracks actual chunk arrival — including the gaps.
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

  // Release the audio hardware when the shell unmounts.
  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return { teletype: enabled, toggleTeletype: toggle };
}
