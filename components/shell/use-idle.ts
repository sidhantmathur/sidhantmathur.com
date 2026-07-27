"use client";

import { useEffect, useRef, useState } from "react";

// Idle mode (roadmap Sprint 2, #14) — after a long enough pause the instruments
// keep humming: the conversation column settles back and a build-time one-liner
// types itself out underneath it.
//
// ZERO API CALLS, which is the entire design constraint. The lines are a
// constant in shell-data.ts, shipped with the bundle. An idle tab costs nothing
// and calls nothing, forever.
//
// Any real input — a key, a pointer, a scroll, coming back to the tab — ends it
// immediately, and a turn in flight never starts it. It's an ambient state, not
// a mode: nothing about what a visitor can do changes while it's on.

/** Long enough that it never fires on someone who is simply reading an answer. */
export const IDLE_AFTER_MS = 90_000;

export function useIdle(enabled: boolean, afterMs: number = IDLE_AFTER_MS): boolean {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Deferred, like every other setState-from-an-effect in the shell: doing
      // it synchronously in the effect body cascades a second render.
      queueMicrotask(() => setIdle(false));
      return;
    }

    function arm() {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setIdle(true), afterMs);
    }

    function wake() {
      setIdle((was) => (was ? false : was));
      arm();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") wake();
    }

    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
    for (const event of events) {
      window.addEventListener(event, wake, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    arm();

    return () => {
      for (const event of events) window.removeEventListener(event, wake);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [enabled, afterMs]);

  return idle;
}

/**
 * Types a string out one character at a time, then holds it. Returns the whole
 * string at once when the reader has asked for reduced motion — the point is
 * the words, and a teleprinter effect is exactly the kind of thing that setting
 * exists to switch off.
 */
export function useTypedText(text: string, msPerChar = 45): string {
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      queueMicrotask(() => setShown(text));
      return;
    }
    queueMicrotask(() => setShown(""));
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [text, msPerChar]);

  return shown;
}
