"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

// The desktop context panel's width: restored from the last visit, dragged by
// the splitter, and nudged from the keyboard. Below lg the panel is a bottom
// sheet and none of this applies.

const PANEL_WIDTH_KEY = "panel.width.v1";
export const PANEL_MIN = 300;
export const PANEL_MAX = 640;
const PANEL_DEFAULT = 380;

export function usePanelWidth() {
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);

  // Restored after mount, so the first client render matches the server's.
  useEffect(() => {
    const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n)) {
      queueMicrotask(() => setPanelWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, n))));
    }
  }, []);

  // Drag-to-resize. Hand-rolled rather than pulling in react-resizable-panels
  // for one divider.
  const dragging = useRef(false);
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragging.current) return;
      const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, window.innerWidth - e.clientX));
      setPanelWidth(next);
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
      try {
        window.localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
      } catch {
        /* persistence is a nicety */
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [panelWidth]);

  const onPointerDown = useCallback(() => {
    dragging.current = true;
    document.body.style.userSelect = "none";
  }, []);

  const onDoubleClick = useCallback(() => setPanelWidth(PANEL_DEFAULT), []);

  // Keyboard-operable splitter: arrows nudge, shift-arrows jump, Home and End
  // go to the stops, and Enter (like a double click) restores the default.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const step = e.shiftKey ? 64 : 16;
      let next: number | null = null;
      if (e.key === "ArrowLeft") next = panelWidth + step;
      else if (e.key === "ArrowRight") next = panelWidth - step;
      else if (e.key === "Home") next = PANEL_MAX;
      else if (e.key === "End") next = PANEL_MIN;
      else if (e.key === "Enter") next = PANEL_DEFAULT;
      if (next == null) return;
      e.preventDefault();
      const clamped = Math.min(PANEL_MAX, Math.max(PANEL_MIN, next));
      setPanelWidth(clamped);
      try {
        window.localStorage.setItem(PANEL_WIDTH_KEY, String(clamped));
      } catch {
        /* persistence is a nicety */
      }
    },
    [panelWidth],
  );

  return { width: panelWidth, onPointerDown, onDoubleClick, onKeyDown };
}
