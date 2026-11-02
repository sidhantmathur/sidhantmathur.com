"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { PANEL_MAX, PANEL_MIN } from "./use-panel-width";

// Context panel — desktop, resizable. Below lg the same content is a bottom
// sheet (mobile-sheets.tsx), and none of this renders.
export function ContextPanel({
  title,
  width,
  onClose,
  children,
}: {
  /** What the header shows, and the landmark's name. */
  title: string;
  /** usePanelWidth(): the width and the splitter's handlers. */
  width: {
    width: number;
    onPointerDown: () => void;
    onDoubleClick: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  };
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {/* Keyboard-operable splitter: arrows nudge, shift-arrows jump,
          Home and End go to the stops, and Enter (like a double click)
          restores the default. aria-valuenow makes the width audible. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        aria-valuenow={Math.round(width.width)}
        aria-valuemin={PANEL_MIN}
        aria-valuemax={PANEL_MAX}
        tabIndex={0}
        onPointerDown={width.onPointerDown}
        onDoubleClick={width.onDoubleClick}
        onKeyDown={width.onKeyDown}
        className="hidden w-1 shrink-0 cursor-col-resize bg-line transition-colors hover:bg-accent focus-visible:bg-accent lg:block"
      />
      {/* Labelled with the title its header shows, so it's an
          identifiable landmark rather than an unnamed region. */}
      <aside
        aria-label={title}
        style={{ width: width.width }}
        className="hidden shrink-0 flex-col border-l border-line bg-panel lg:flex"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4 t-meta">
          <span className="truncate text-text-faint">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-full shrink-0 items-center px-2 text-text-faint hover:text-accent"
          >
            close ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </aside>
    </>
  );
}
