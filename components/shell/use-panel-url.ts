"use client";

import { useEffect } from "react";
import type { ProjectSlug } from "@/content/projects";
import { PANEL_BY_PATH, PANELS, type PanelView } from "./panels";

// Keeps the context panel and the address bar in sync.
//
// Not parallel/intercepting routes: those suit a surface that only a route
// opens, and this panel is also opened by tool calls mid-conversation, which
// have no URL. A route slot plus client state would be two sources of truth
// for what the panel shows. So the panel is client state and the URL follows
// it via history.pushState, which the App Router allows without a navigation
// or unmounting the shell. A direct hit still gets the server-rendered page at
// that URL.

// `project` is the one kind with an address the registry can't state, since it
// depends on the slug. The registry says `path: null` and the route is built
// here.
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
 * The address a panel state should show. The panel owns the path only; the
 * query and fragment are kept. The fragment is a permalinked conversation, and
 * the query carries an application link's `?ref=` (lib/analytics.ts), which a
 * replayed fit check would otherwise drop by opening its panel on load, before
 * analytics has read it.
 */
export function panelHref(panel: PanelView, hash: string, search = ""): string {
  return (pathForPanel(panel) ?? "/") + search + hash;
}

export function usePanelUrl(panel: PanelView, setPanel: (v: PanelView) => void) {
  // Panel → URL.
  useEffect(() => {
    const search = window.location.search;
    const target = panelHref(panel, window.location.hash, search);
    if (window.location.pathname + search + window.location.hash === target) return;
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
