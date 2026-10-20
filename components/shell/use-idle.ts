"use client";

import { useEffect, useRef, useState } from "react";

// Idle mode (docs/idea-decisions.md #14): after a long pause the conversation
// column dims, the ambient backdrop returns and a one-liner from IDLE_LINES in
// shell-data.ts fades in beneath it. It makes no API calls; the lines ship with
// the bundle. Any real input or a return to the tab ends it, and a turn in
// flight never starts it. Nothing a visitor can do changes while it is on.

/** Long enough that it never fires on someone who is simply reading an answer. */
export const IDLE_AFTER_MS = 90_000;

export function useIdle(enabled: boolean, afterMs: number = IDLE_AFTER_MS): boolean {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Deferred: a synchronous setState in the effect body cascades a render.
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
 * string at once under prefers-reduced-motion.
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
