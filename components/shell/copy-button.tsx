"use client";

import { useEffect, useRef, useState } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

// Copy-to-clipboard affordance. The site stores nothing server-side, so the
// clipboard is how a useful answer leaves the page — into an email, a Slack
// thread, an ATS note.
//
// Labels here are UI affordances, not site copy (same standing as the slash
// commands in shell-data.ts).

type Props = {
  /** Called at click time, so a streaming message is serialized when copied. */
  getText: () => string;
  label: string;
  /** Confirmation label; falls back to "copied". */
  copiedLabel?: string;
  /** PostHog event name. */
  event?: AnalyticsEvent;
  className?: string;
  /**
   * Fires only on a copy that actually reached the clipboard — the actions
   * strip's post-action emphasis (#27) hangs off this, and emphasising a copy
   * that silently failed would be the site lying about its own state.
   */
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
      // Insecure context, denied permission, or no clipboard API. Nothing
      // useful to say — silently leave the label unchanged rather than
      // claiming a copy that didn't happen.
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
      className={`text-[11px] transition-colors ${
        copied ? "text-accent" : "text-text-faint hover:text-accent"
      } ${className}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
