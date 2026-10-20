"use client";

import { useEffect } from "react";
import { initAnalytics, rememberLanding } from "@/lib/analytics";

// Initializes PostHog on the client exactly once. Renders nothing. When
// NEXT_PUBLIC_POSTHOG_KEY is unset, initAnalytics is a no-op with no network
// calls.
//
// Deferred to idle rather than run on mount, so fetching a third-party SDK
// never competes with hydration on a slow connection; the first event is a
// pageview, which is just as true a second later. Safari has no
// requestIdleCallback, so the timeout is the fallback there and the ceiling
// everywhere else, for a page that never goes idle.
//
// The landing address is read on mount, not at idle: an application link's
// `?ref=` (see lib/analytics.ts) is only guaranteed to be in the address bar at
// first paint, because a replayed fit check pushes a new address long before
// the idle callback fires.
export function AnalyticsProvider() {
  useEffect(() => {
    rememberLanding();
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
