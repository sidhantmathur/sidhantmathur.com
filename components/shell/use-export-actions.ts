"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { conversationToMarkdown } from "@/lib/transcript";
import { permalinkFor } from "@/lib/permalink";
import { DISCLAIMER, SITE_NAME, SITE_URL } from "@/lib/site";
import { track } from "@/lib/analytics";
import type { ChatMessage, PanelView } from "./use-conversation";

// The export actions and the strip that carries them. Two hooks rather than
// one because they sit either side of the shell's openPanel: opening a
// citation bumps the strip, and copying a link falls back to opening the
// export panel.

/**
 * After an action, the always-present strip gains a little weight for a few
 * seconds. Nothing new appears, and nothing has to guess when a visit ends.
 */
export function useStripEmphasis() {
  const [emphasis, setEmphasis] = useState(false);
  const emphasisTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpStrip = useCallback(() => {
    setEmphasis(true);
    if (emphasisTimer.current) clearTimeout(emphasisTimer.current);
    emphasisTimer.current = setTimeout(() => setEmphasis(false), 6000);
  }, []);
  useEffect(
    () => () => {
      if (emphasisTimer.current) clearTimeout(emphasisTimer.current);
    },
    [],
  );
  return { emphasis, bumpStrip };
}

export function useExportActions({
  messages,
  bumpStrip,
  openPanel,
}: {
  messages: ChatMessage[];
  bumpStrip: () => void;
  openPanel: (view: PanelView) => void;
}) {
  // The link is held in the shell rather than in the export panel because the
  // print document carries it too. A permalink describes the turns it was
  // built from, so it's remembered with that turn count and stops being
  // current the moment another turn lands. Derived rather than cleared in an
  // effect, so there's no window where the panel shows a link to a shorter
  // conversation.
  const [builtLink, setBuiltLink] = useState<{ link: string; at: number } | null>(null);
  const permalink = builtLink && builtLink.at === messages.length ? builtLink.link : null;
  const setPermalink = useCallback(
    (link: string | null) => setBuiltLink(link ? { link, at: messages.length } : null),
    [messages.length],
  );

  // One place that says what a copied conversation looks like, so the strip,
  // the export panel and the rail can't drift into three different documents.
  const conversationMarkdown = useCallback(
    () =>
      conversationToMarkdown(messages, {
        title: SITE_NAME,
        sourceUrl: SITE_URL,
        footer: DISCLAIMER,
        permalink: permalink ?? undefined,
      }),
    [messages, permalink],
  );

  // The strip's one-tap version of the export panel's Link section. On a
  // clipboard failure it opens the panel instead, where the link is visible and
  // selectable — silently doing nothing is the one outcome worth avoiding.
  const copyLink = useCallback(async () => {
    try {
      const link = await permalinkFor(`${window.location.origin}/`, messages);
      setPermalink(link);
      track("chat_permalink_created", { chars: link.length });
      await navigator.clipboard.writeText(link);
      bumpStrip();
      return true;
    } catch {
      openPanel({ kind: "export" });
      return false;
    }
  }, [messages, openPanel, bumpStrip, setPermalink]);

  return { permalink, setPermalink, conversationMarkdown, copyLink };
}
