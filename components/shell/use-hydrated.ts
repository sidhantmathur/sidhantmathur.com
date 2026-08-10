"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and on the client's first render; true from the frame
 * React has finished hydrating.
 *
 * WHY THIS EXISTS. On a slow connection the shell paints long before its
 * JavaScript arrives, and for those seconds the page is a photograph of an
 * application: a composer with a cursor in it, a send button, four question
 * chips, a status strip that says "ready". Tapping any of it did nothing at
 * all — no press state, no error, no hint that the tap was heard and dropped —
 * and the send button, being a real submit inside a real form, could do
 * something worse than nothing: a native GET submit that navigates the page
 * away and throws the load out.
 *
 * Measured on the throttled mobile profile (scripts/perf.mjs), that window was
 * 3.8 seconds. This hook is how the shell stops lying during it. Controls that
 * need JavaScript read this and render disabled until it flips, which is both
 * the honest state and — for the composer's submit button — the thing that
 * makes the native submit impossible.
 *
 * The `data-hydrated` attribute on <html> is the same fact in CSS's reach, for
 * the controls that are cheaper to gate with a selector than with a prop (see
 * the pre-hydration block in app/globals.css). scripts/perf.mjs reads it too,
 * which is what makes the dead window a number rather than an impression.
 *
 * Starting at false and flipping in an effect is deliberate: the server HTML
 * and the client's first render agree, so there is no hydration mismatch — the
 * enable is a second render, not a correction.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // The attribute is written straight away — it is an external system, which
    // is what an effect is for, and CSS and scripts/perf.mjs both read it.
    document.documentElement.dataset.hydrated = "true";
    // The state flip is queued, matching the idiom the rest of the shell uses
    // for the same reason (see the media-query and panel-width effects in
    // app-shell.tsx): a setState in an effect body is a cascading render, and
    // the lint rule that says so is right.
    queueMicrotask(() => setHydrated(true));
  }, []);
  return hydrated;
}
