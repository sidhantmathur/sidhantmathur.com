"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { readoutValues, type ReadoutState } from "./readouts";

// The two sheets the shell becomes below lg: the rail on the left, the context
// panel along the bottom.
//
// Its own module so it can load late. It depends on Radix's dialog (portal,
// overlay, focus trap, scroll lock), which nothing needs until a sheet opens.
// The index sheet opens at every width; the panel sheet only below lg. It
// holds no state; it owns how a sheet behaves and takes the readouts as
// numbers (see readouts.ts).
export function MobileSheets({
  rail,
  panel,
  readouts,
}: {
  rail: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Hands focus back to the control that opened it. See app-shell.tsx. */
    onClosed: () => void;
    content: ReactNode;
  };
  panel: {
    /** Whether a panel is selected at all. */
    open: boolean;
    /** Whether the sheet showing it is up (false once dismissed). Both must hold. */
    sheetOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    /** The same focus return as the rail's, from several possible openers. */
    onClosed: () => void;
    title: string;
    content: ReactNode;
    full: boolean;
    onToggleFull: () => void;
  };
  readouts: ReadoutState;
}) {
  const reading = readoutValues(readouts);
  return (
    <>
      <Sheet open={rail.open} onOpenChange={rail.onOpenChange}>
        <SheetContent
          side="left"
          // The primitive is meant to return focus to whatever opened the
          // dialog and doesn't (`npm run a11y` found focus on <body>), so the
          // shell restores it.
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            rail.onClosed();
          }}
          // Scrolls because on a short phone the rail is more than one
          // screen. The bottom pad clears the home indicator on a notched
          // phone.
          showCloseButton={false}
          className="w-72 overflow-y-auto overscroll-contain border-line bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] t-meta text-text [font-family:var(--font-geist-mono)]"
        >
          {/* Title and close on one row, matching the bottom sheet's header
              rather than the default floating ✕. */}
          <SheetHeader className="-mr-2 -my-2 flex-row items-center gap-2 space-y-0 p-0">
            <SheetTitle className="min-w-0 flex-1 truncate t-meta font-normal text-text-faint">
              Index
            </SheetTitle>
            <SheetClose
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center t-meta text-text-faint transition-colors hover:text-accent"
            >
              ✕
            </SheetClose>
          </SheetHeader>
          {rail.content}
          {/* The header's receipt is hidden at this width, so the rail
              carries the readouts. Instruments, above, opens the full deck. */}
          <div className="mt-4 border-t border-line pt-3 text-text-faint">
            <div>turns {reading.turns}</div>
            <div>ttft {reading.ttft}</div>
            <div>est. {reading.cost}</div>
            <div className="truncate">model {reading.model}</div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dismissing the sheet closes the panel outright rather than only
          hiding it, so the address bar never names a panel that isn't open. */}
      <Sheet
        open={panel.sheetOpen && panel.open}
        onOpenChange={(open) => (open ? panel.onOpen() : panel.onClose())}
      >
        <SheetContent
          side="bottom"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            panel.onClosed();
          }}
          style={{ height: panel.full ? "88dvh" : "52dvh" }}
          // The default floating close sits top-right, over the size toggle,
          // so the header row supplies its own.
          showCloseButton={false}
          className="border-line bg-panel p-0 text-text transition-[height] duration-200 [font-family:var(--font-geist-mono)]"
        >
          <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b border-line py-0 pl-4 pr-1">
            <SheetTitle className="min-w-0 flex-1 truncate t-meta font-normal text-text-faint">
              {panel.title}
            </SheetTitle>
            {/* Both controls fill the header's height: this surface is only
                ever touched. */}
            <button
              type="button"
              onClick={panel.onToggleFull}
              aria-expanded={panel.full}
              className="flex h-11 shrink-0 touch-manipulation items-center px-2 t-meta text-text-faint transition-colors hover:text-accent"
            >
              {panel.full ? "collapse ↓" : "expand ↑"}
            </button>
            <SheetClose
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center t-meta text-text-faint transition-colors hover:text-accent"
            >
              ✕
            </SheetClose>
          </SheetHeader>
          {/* The pad clears the home indicator on a notched phone and
              resolves to 0 elsewhere. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {panel.content}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
