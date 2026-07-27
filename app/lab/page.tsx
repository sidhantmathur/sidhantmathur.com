import type { Metadata } from "next";
import { LabChat } from "./lab-chat";

// PROTOTYPE ROUTE — not linked from anywhere, noindex.
//
// Renders as a fixed full-viewport overlay above the site's own chrome
// (header z-40, sticky chat bar z-50, overlay z-100), so nothing in
// app/layout.tsx, app/globals.css, or any existing component had to change.
// Delete this directory to remove the prototype entirely.
//
// Colors come from the dark system in globals.css. The legacy paper/ink tokens
// still back the routes that haven't been migrated yet, so the rest of the site
// renders exactly as before.

export const metadata: Metadata = {
  title: "Lab — Sidhant Mathur",
  robots: { index: false, follow: false },
};

// Colors now come from the dark system in globals.css (00-decisions.md §2) via
// Tailwind utilities — bg-bg, border-line, text-text-soft, and so on. What's
// left here is only what a utility class can't express: selection, scrollbars,
// and the native color-scheme hint for form controls inside the overlay.
const CHROME = `
.lab { color-scheme: dark; }
.lab ::selection { background: var(--accent); color: var(--bg); }
.lab *::-webkit-scrollbar { width: 10px; height: 10px; }
.lab *::-webkit-scrollbar-thumb { background: var(--line-strong); }
.lab *::-webkit-scrollbar-track { background: transparent; }
`;

export default function LabPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CHROME }} />
      <LabChat />
    </>
  );
}
