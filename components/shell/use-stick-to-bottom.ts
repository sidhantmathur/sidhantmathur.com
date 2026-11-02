"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "./use-conversation";

// Stick-to-bottom: streaming keeps the view pinned while the reader is at the
// bottom, and stops yanking them down once they scroll up to reread.
export function useStickToBottom(messages: ChatMessage[], replayed: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    // Not when there's nothing to stick to: the empty state is taller than a
    // phone, and pinning it would land the visitor halfway down with the
    // headline scrolled off. Not onto a replay either: it's a page someone was
    // sent, so it opens at the top with its banner and contact actions in
    // view. Sticking resumes with the reader's first new message.
    const replaying = replayed && messages[messages.length - 1]?.id.startsWith("replay-");
    if (el && stick.current && messages.length && !replaying) el.scrollTop = el.scrollHeight;
  }, [messages, replayed]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) stick.current = el.scrollHeight - el.clientHeight - el.scrollTop < 120;
  }, []);

  /** Pin to the bottom again: the reader's own next question, or a resume. */
  const pin = useCallback(() => {
    stick.current = true;
  }, []);

  return { scrollRef, onScroll, pin };
}
