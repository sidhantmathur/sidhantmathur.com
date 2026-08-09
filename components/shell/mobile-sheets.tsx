"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// The two sheets the shell becomes below lg: the rail on the left, the context
// panel along the bottom.
//
// LIFTED OUT OF app-shell.tsx SO IT CAN BE LOADED LATE. Everything here depends
// on Radix's dialog — portal, overlay, focus trap, scroll lock, escape
// handling — which is worth every byte once a sheet opens and worth none of
// them before. It used to be part of the entry chunk on every device, including
// the desktops that can never open a sheet at all.
//
// Deliberately dumb: it holds no state and computes nothing. Open/closed,
// titles and the readouts all arrive as props, so the split is a load-order
// change and nothing else. The one piece of behaviour it keeps is the
// dismiss-closes-the-panel rule, because that is a property of the sheet rather
// than of the shell — see the note on the bottom sheet.
export function MobileSheets({
  railOpen,
  onRailOpenChange,
  rail,
  readouts,
  panelOpen,
  panelTitle,
  panelContent,
  sheetOpen,
  onSheetOpen,
  onClosePanel,
  sheetFull,
  onToggleFull,
}: {
  railOpen: boolean;
  onRailOpenChange: (open: boolean) => void;
  rail: ReactNode;
  readouts: { turns: string; ttft: string; cost: string; model: string };
  panelOpen: boolean;
  panelTitle: string;
  panelContent: ReactNode;
  sheetOpen: boolean;
  onSheetOpen: () => void;
  onClosePanel: () => void;
  sheetFull: boolean;
  onToggleFull: () => void;
}) {
  return (
    <>
      <Sheet open={railOpen} onOpenChange={onRailOpenChange}>
        <SheetContent
          side="left"
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
          {rail}
          {/* The header readouts are hidden at this width, so the rail
              carries the same four numbers. Tapping Instruments above
              opens the full deck as a sheet. */}
          <div className="mt-4 border-t border-line pt-3 text-text-faint">
            <div>turns {readouts.turns}</div>
            <div>ttft {readouts.ttft}</div>
            <div>est. {readouts.cost}</div>
            <div className="truncate">model {readouts.model}</div>
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
        open={sheetOpen && panelOpen}
        onOpenChange={(open) => (open ? onSheetOpen() : onClosePanel())}
      >
        <SheetContent
          side="bottom"
          style={{ height: sheetFull ? "88dvh" : "52dvh" }}
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
              {panelTitle}
            </SheetTitle>
            {/* Both controls fill the header's height. As bare labels they
                were ~16px tall targets on the surface that is only ever
                touched. */}
            <button
              type="button"
              onClick={onToggleFull}
              aria-expanded={sheetFull}
              className="flex h-11 shrink-0 touch-manipulation items-center px-2 text-[13px] text-text-faint transition-colors hover:text-accent"
            >
              {sheetFull ? "collapse ↓" : "expand ↑"}
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
            {panelContent}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
