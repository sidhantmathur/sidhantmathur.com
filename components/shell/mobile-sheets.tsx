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
// LIFTED OUT OF app-shell.tsx SO IT CAN BE LOADED LATE. Everything here depends
// on Radix's dialog — portal, overlay, focus trap, scroll lock, escape
// handling — which is worth every byte once a sheet opens and worth none of
// them before. It used to be part of the entry chunk on every device, including
// the desktops that can never open a sheet at all.
//
// It holds no state. What it does own is how a sheet behaves and how a readout
// reads: the dismiss-closes-the-panel rule below is a property of the sheet
// rather than of the shell, and the four numbers arrive as numbers and are
// formatted here (see readouts.ts) instead of arriving pre-rendered.
//
// The props are grouped by the thing they describe — the rail, the panel, the
// readouts — because they were fourteen flat ones and reading the call site
// meant matching `sheetFull` against `panelOpen` against `railOpen` by eye.
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
    /** Whether a panel is selected at all — the URL's `panel` param. */
    open: boolean;
    /** Whether the sheet showing it has been dismissed. Both must hold. */
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
          // dialog and does not — measured, `npm run a11y`: focus landed on
          // <body>. preventDefault stops the library's own (absent) restore and
          // the shell puts it where it belongs.
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            rail.onClosed();
          }}
          // Scrolls because the rail now carries the readouts and the
          // transcript controls the header and input row drop at this
          // width — on a short phone that is more than one screen, and
          // the overflow was landing on the controls at the bottom.
          // The bottom pad clears the home indicator: the readouts are the
          // last thing in this column and they used to end flush with the
          // sheet's edge, under the bar on a notched phone.
          showCloseButton={false}
          className="w-72 overflow-y-auto overscroll-contain border-line bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-[13px] text-text [font-family:var(--font-geist-mono)]"
        >
          {/* Title and close on one row, sized and worded like the bottom
              sheet's — the default floating ✕ was a different glyph at a
              different size sitting off the title's baseline. */}
          <SheetHeader className="-mr-2 -my-2 flex-row items-center gap-2 space-y-0 p-0">
            <SheetTitle className="min-w-0 flex-1 truncate text-[13px] font-normal text-text-faint">
              Index
            </SheetTitle>
            <SheetClose
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-[13px] text-text-faint transition-colors hover:text-accent"
            >
              ✕
            </SheetClose>
          </SheetHeader>
          {rail.content}
          {/* The header readouts are hidden at this width, so the rail
              carries the same four numbers. Tapping Instruments above
              opens the full deck as a sheet. */}
          <div className="mt-4 border-t border-line pt-3 text-text-faint">
            <div>turns {reading.turns}</div>
            <div>ttft {reading.ttft}</div>
            <div>est. {reading.cost}</div>
            <div className="truncate">model {reading.model}</div>
          </div>

          {/* The transcript controls used to be duplicated here, because
              the input row dropped them below sm. The actions strip is
              present at every width now, so this is one place fewer for
              the same two buttons to drift apart. */}
        </SheetContent>
      </Sheet>

      {/* Dismissing the sheet closes the panel outright rather than only
          hiding it. They used to disagree: tapping away left `panel` set,
          so the address bar still read /resume with nothing open, and that
          was the URL you'd copy. */}
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
          // The sheet supplies its own close control in the header row, so
          // the default floating one is off: it is positioned top-right,
          // which is exactly where the size toggle sits, and the two
          // overlapped by 24px — the close button won, and expand was
          // unhittable.
          showCloseButton={false}
          className="border-line bg-panel p-0 text-text transition-[height] duration-200 [font-family:var(--font-geist-mono)]"
        >
          <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b border-line py-0 pl-4 pr-1">
            <SheetTitle className="min-w-0 flex-1 truncate text-[13px] font-normal text-text-faint">
              {panel.title}
            </SheetTitle>
            {/* Both controls fill the header's height. As bare labels they
                were ~16px tall targets on the surface that is only ever
                touched. */}
            <button
              type="button"
              onClick={panel.onToggleFull}
              aria-expanded={panel.full}
              className="flex h-11 shrink-0 touch-manipulation items-center px-2 text-[13px] text-text-faint transition-colors hover:text-accent"
            >
              {panel.full ? "collapse ↓" : "expand ↑"}
            </button>
            <SheetClose
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-[13px] text-text-faint transition-colors hover:text-accent"
            >
              ✕
            </SheetClose>
          </SheetHeader>
          {/* The pad clears the home indicator on a notched phone, where
              the last row of a panel otherwise sits under the bar. It
              resolves to 0 everywhere else. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {panel.content}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
