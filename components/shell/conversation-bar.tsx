"use client";

import { MAX_USER_MESSAGES } from "@/lib/models";

// The way out of a conversation, and the way back into one. A conversation
// left by Home, a reload or the browser's Back is kept, and the front door
// offers it (ContinueRow in front-door.tsx).
const HOME_LABEL = "Home";
const CONVERSATION_LABEL = "Your conversation";
const REPLAY_LABEL = "Shared conversation";
export const questionCount = (n: number) => `${n} ${n === 1 ? "question" : "questions"}`;

// ---- Conversation bar ---------------------------------------
// A conversation is a place, so it gets a title bar like the
// context panel's, at the same height, with the way out where a
// visitor looks for one: top left, labelled, bordered so it reads
// as a button. The count makes the cap visible before it is hit.
export function ConversationBar({
  onHome,
  replayed,
  turns,
}: {
  /** The front door; see goHome in app-shell.tsx. */
  onHome: () => void;
  replayed: boolean;
  turns: number;
}) {
  return (
    <div className="relative z-10 flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel px-4 text-[13px] md:px-10">
      <button
        type="button"
        onClick={onHome}
        data-js-control
        className="group -ml-1 flex h-full shrink-0 touch-manipulation items-center px-1"
      >
        <span className="flex h-8 items-center gap-1.5 border border-line-strong bg-raised px-2.5 text-text-soft transition-colors group-hover:border-accent group-hover:text-accent">
          <span aria-hidden="true">←</span>
          {HOME_LABEL}
        </span>
      </button>
      {/* Below sm the count needs the room more than the label does. */}
      <span className="hidden min-w-0 truncate text-text-faint sm:inline">
        {replayed ? REPLAY_LABEL : CONVERSATION_LABEL}
      </span>
      <span className="ml-auto shrink-0 tabular-nums text-text-faint">
        {turns} of {questionCount(MAX_USER_MESSAGES)}
      </span>
    </div>
  );
}
