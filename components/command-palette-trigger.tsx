"use client";

import { useSyncExternalStore } from "react";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/command-palette";

const noopSubscribe = () => () => {};
const getKeyHint = () =>
  /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? "") ? "⌘K" : "Ctrl K";
// Server snapshot is null: the shortcut chip only renders on the client,
// where the platform is known — avoids a hydration mismatch.
const getServerKeyHint = () => null;

// Header "Menu" button — the visible entry point to the command palette
// (DocSearch/Linear-style ⌘K pattern). On mobile it's a plain tappable
// button; on desktop it also shows the keyboard shortcut chip.
export function CommandPaletteTrigger() {
  const keyHint = useSyncExternalStore(
    noopSubscribe,
    getKeyHint,
    getServerKeyHint,
  );

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
      className="flex items-center gap-2 font-mono text-xs text-ink no-underline hover:underline"
    >
      Menu
      {keyHint && (
        <kbd className="hidden border border-hairline px-1.5 py-0.5 font-mono text-[10px] font-normal text-ink-soft md:inline-block">
          {keyHint}
        </kbd>
      )}
    </button>
  );
}
