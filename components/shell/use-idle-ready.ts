"use client";

import { useEffect, useState } from "react";

/**
 * False until the page has hydrated and the main thread has gone quiet; true
 * from then on.
 *
 * For things that must exist before the visitor asks for them but must not be
 * part of what they wait for: the print document (nothing can reliably
 * intercept Cmd-P, so it has to be in the DOM already) and the mobile sheets
 * (Radix's dialog is a real chunk, and a sheet that waits on a network round
 * trip feels like a missed tap). Registered from an effect, so the idle
 * callback can't fire before hydration. The 2s timeout is the ceiling for a
 * page that never goes idle.
 */
export function useIdleReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let idle: number | undefined;
    const timer = window.setTimeout(() => setReady(true), 2000);
    const ric = window.requestIdleCallback;
    if (ric) {
      idle = ric(
        () => {
          window.clearTimeout(timer);
          setReady(true);
        },
        { timeout: 2000 },
      );
    }
    return () => {
      window.clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
    };
  }, []);
  return ready;
}
