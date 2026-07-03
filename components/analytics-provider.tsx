"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

// Initializes PostHog on the client exactly once. Renders nothing. When
// NEXT_PUBLIC_POSTHOG_KEY is unset, initAnalytics is a no-op — no network calls.
export function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return null;
}
