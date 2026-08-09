"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

// Initializes PostHog on the client exactly once. Renders nothing. When
// NEXT_PUBLIC_POSTHOG_KEY is unset, initAnalytics is a no-op — no network calls.
//
// DEFERRED PAST HYDRATION, not merely past mount. This effect used to run in the
// same commit as the shell's, which meant that on a slow connection the browser
// spent part of the one window that mattered — the seconds where the page looks
// finished and answers no taps — fetching and evaluating an analytics SDK and
// opening a connection to a third-party origin. None of that is worth a
// millisecond of time-to-interactive: the first thing PostHog records is a
// pageview, and a pageview is just as true a second later.
//
// requestIdleCallback is the right primitive and Safari still doesn't have it,
// so the timeout is both the fallback there and the ceiling everywhere else —
// a page that never goes idle (a conversation streaming from the first second)
// must still eventually report.
export function AnalyticsProvider() {
  useEffect(() => {
    let idle: number | undefined;
    const timer = window.setTimeout(() => initAnalytics(), 2000);
    const ric = window.requestIdleCallback;
    if (ric) {
      idle = ric(
        () => {
          window.clearTimeout(timer);
          initAnalytics();
        },
        { timeout: 2000 },
      );
    }
    return () => {
      window.clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
    };
  }, []);
  return null;
}
