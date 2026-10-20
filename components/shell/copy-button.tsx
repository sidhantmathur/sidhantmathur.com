"use client";

import { useEffect, useRef, useState } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

// Copy-to-clipboard button. Its labels are UI affordances, not site copy.

type Props = {
  /** Called at click time, so a streaming message is serialized when copied. */
  getText: () => string;
  label: string;
  /** Confirmation label; falls back to "copied". */
  copiedLabel?: string;
  /** PostHog event name. */
  event?: AnalyticsEvent;
  className?: string;
  /** Fires only on a copy that actually reached the clipboard. */
  onCopied?: () => void;
};

export function CopyButton({
  getText,
  label,
  copiedLabel = "copied",
  event,
  className = "",
  onCopied,
}: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A click immediately before unmount would otherwise set state on a gone
  // component when the timer fires.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    const text = getText();
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Insecure context, denied permission, or no clipboard API: leave the
      // label unchanged rather than claim a copy that didn't happen.
      return;
    }
    if (event) track(event, { chars: text.length });
    onCopied?.();
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={`t-meta transition-colors ${
        copied ? "text-accent" : "text-text-faint hover:text-accent"
      } ${className}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
