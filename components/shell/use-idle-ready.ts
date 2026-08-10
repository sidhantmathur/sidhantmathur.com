"use client";

import { useEffect, useState } from "react";

/**
 * False until the page is interactive AND the main thread has gone quiet;
 * true from then on, forever.
 *
 * This is the "not now, but soon, and definitely" slot in the load. Two things
 * in the shell belong in it, and both have the same awkward shape: they must
 * exist before the visitor asks for them, and they must not be part of what the
 * visitor waits for.
 *
 *   the print document   nothing can reliably intercept Cmd-P, so it has to
 *                        already be in the DOM when the dialog opens
 *   the mobile sheets    Radix's dialog is a real chunk of JavaScript, and a
 *                        sheet that takes a network round trip to open is a
 *                        tap that appears to have missed
 *
 * Hanging both off an effect means they load after hydration rather than
 * before it — hydration is the gate, so an idle callback registered from here
 * cannot fire while the page is still assembling itself. The 2s timeout is the
 * ceiling: a page that never goes idle still gets its print document.
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
