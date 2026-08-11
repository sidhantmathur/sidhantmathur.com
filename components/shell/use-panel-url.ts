"use client";

import { useEffect } from "react";
import type { ProjectSlug } from "@/content/projects";
import { PANEL_BY_PATH, PANELS, type PanelView } from "./panels";

// Keeps the context panel and the address bar in sync.
//
// WHY NOT INTERCEPTING ROUTES. The plan called for Next's parallel +
// intercepting routes (the Instagram photo-modal pattern). They're the right
// tool when a route is the ONLY thing that opens the surface. Here it isn't:
// the panel is also opened by tool calls mid-conversation (a citation, a
// role-fit breakdown) which have no URL and never should. Driving one surface
// from both a route slot and client state means two sources of truth for
// "what is the panel showing", and they drift.
//
// So the panel stays client state — one owner — and the URL follows it via
// history.pushState, which the App Router supports without triggering a
// navigation or unmounting the shell. The result is the same for a visitor:
// no page load, a shareable address, working back button. And a direct hit or
// a crawler still gets the real server-rendered page at that URL, because
// those routes are untouched.

// Both directions read the registry's `path`. The one panel it can't describe
// is `project`, whose address depends on which project — so the slug's own
// route is built here, and the registry says `path: null` for that kind.
const PROJECT_PATH = /^\/projects\/(adarle20|nokia|dell-ml)$/;

/** The panel view a given path represents, if any. */
export function panelForPath(path: string): PanelView | null {
  const project = path.match(PROJECT_PATH);
  if (project) return { kind: "project", slug: project[1] as ProjectSlug };
  const kind = PANEL_BY_PATH[path];
  return kind ? { kind } : null;
}

function pathForPanel(panel: PanelView): string | null {
  if (panel.kind === "project") return `/projects/${panel.slug}`;
  return PANELS[panel.kind].path;
}

/**
 * The address a panel state should show, keeping any fragment.
 *
 * THE FRAGMENT IS THE CONVERSATION (Sprint 5, #18). `pushState(null, "", "/")`
 * drops the hash, so opening a panel while reading a permalink used to erase
 * the very thing being read — invisibly, and only discoverable by reloading.
 * The panel owns the path; it has no opinion about the fragment.
 */
export function panelHref(panel: PanelView, hash: string): string {
  return (pathForPanel(panel) ?? "/") + hash;
}

export function usePanelUrl(panel: PanelView, setPanel: (v: PanelView) => void) {
  // Panel → URL.
  useEffect(() => {
    const target = panelHref(panel, window.location.hash);
    if (window.location.pathname + window.location.hash === target) return;
    window.history.pushState(null, "", target);
  }, [panel]);

  // URL → panel, so Back and Forward move through opened views rather than
  // leaving the shell.
  useEffect(() => {
    function onPop() {
      const next = panelForPath(window.location.pathname);
      setPanel(next ?? { kind: "none" });
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setPanel]);
}
