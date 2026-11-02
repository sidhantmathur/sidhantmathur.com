"use client";

import { useEffect, useState } from "react";

/**
 * Whether a media query matches. Starts false, so the first client render
 * matches the server's, and settles after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = (m: MediaQueryList | MediaQueryListEvent) =>
      queueMicrotask(() => setMatches(m.matches));
    apply(mq);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return matches;
}
