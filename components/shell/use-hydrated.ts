"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and on the client's first render; true from the frame
 * React has finished hydrating.
 *
 * On a slow connection the shell paints seconds before its JavaScript arrives
 * (3.8 s on the throttled mobile profile in scripts/perf.mjs), and taps in that
 * window would go nowhere. Controls that need JavaScript read this and render
 * disabled until it flips, so they say they can't act yet instead.
 *
 * `data-hydrated` on <html> is the same fact for CSS (the pre-hydration block
 * in app/globals.css) and for scripts/perf.mjs, which measures the window.
 *
 * Starting false and flipping in an effect keeps the server HTML and the first
 * client render identical, so there is no hydration mismatch.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
    // Queued, as elsewhere in the shell: a synchronous setState in an effect
    // body is a cascading render, which the lint rule flags.
    queueMicrotask(() => setHydrated(true));
  }, []);
  return hydrated;
}
