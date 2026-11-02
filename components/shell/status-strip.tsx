"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { HEADER_NAV } from "./shell-data";
import { receiptText } from "./readouts";
import { SITE_NAME } from "@/lib/site";
import type { PanelView } from "./use-conversation";

// ---- Status strip -----------------------------------------------------------
//
// The header: the index button, the name (the way home), where he is once a
// conversation has replaced the front door, the site nav and, from lg up, the
// receipt.
export function StatusStrip({
  railTriggerRef,
  onOpenRail,
  hydrated,
  onHome,
  hasMessages,
  onOpenPanel,
  turns,
  lastAnswerCost,
}: {
  /** The index button, which the index sheet hands focus back to. */
  railTriggerRef: RefObject<HTMLButtonElement | null>;
  onOpenRail: () => void;
  hydrated: boolean;
  /** The front door; see goHome in app-shell.tsx. */
  onHome: () => void;
  hasMessages: boolean;
  onOpenPanel: (view: PanelView) => void;
  turns: number;
  lastAnswerCost: number | null;
}) {
  return (
    <header className="t-meta flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 md:h-16 md:px-4">
      {/* The one way into the full index, at every width. A full 44px
          target, drawn as an SVG because the Unicode trigram renders
          inconsistently across platforms and hairline-thin on iOS. */}
      <button
        ref={railTriggerRef}
        type="button"
        onClick={() => onOpenRail()}
        aria-label="Open the index"
        // `disabled` as well as the CSS gate: `pointer-events: none` stops a
        // tap but leaves the button in the tab order, where Enter before
        // hydration would silently do nothing.
        disabled={!hydrated}
        data-js-control
        className="-ml-1.5 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-text-soft hover:text-accent"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
          aria-hidden="true"
        >
          <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
      </button>
      {/* Fills the strip for the same reason the index button does: a line
          of text isn't a touch target.
          The name is the way home, and on this route a link to "/" is a
          link to where the visitor already is, so it did nothing from
          inside a conversation. A plain click goes to the front door;
          a modified one still opens the site in a new tab. */}
      <Link
        href="/"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onHome();
        }}
        className="-mx-2 flex h-full touch-manipulation items-center px-2 text-text no-underline hover:text-accent"
      >
        {SITE_NAME}
      </Link>
      {/* The front door says where he is two lines below, beside the
          photo; the header carries it once a conversation replaces that. */}
      {hasMessages && <span className="hidden text-text-faint lg:inline">Toronto, ON</span>}

      <div className="ml-auto flex items-center gap-2 text-text-faint sm:gap-4">
        {/* The nav stays at every width, conversation or not, so the resume
            and contact links are there once a visitor shows interest. A
            phone drops Projects below 440px, where the index still carries
            it — the name and three links at the meta size don't fit beside
            the index button on a 390px screen. Live readouts belong to the instruments panel; the header
            keeps only the receipt below. */}
        <nav aria-label="Site" className="flex items-center text-text-soft">
          {HEADER_NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              className={`h-11 touch-manipulation items-center px-1.5 no-underline transition-colors hover:text-accent sm:px-3 ${
                n.label === "Projects" ? "hidden min-[440px]:flex" : "flex"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => onOpenPanel({ kind: "contact" })}
            disabled={!hydrated}
            data-js-control
            className="flex h-11 touch-manipulation items-center px-1.5 transition-colors hover:text-accent sm:px-3"
          >
            Contact
          </button>
        </nav>
        {/* The receipt: turns used and what the last answer cost, and the
            way into everything else. lg and up, where it fits beside the
            nav; below that the ☰ index carries the same numbers and the
            Instruments entry. */}
        {hasMessages && (
          <button
            type="button"
            onClick={() => onOpenPanel({ kind: "instruments" })}
            title="Open the technical details"
            disabled={!hydrated}
            data-js-control
            className="hidden h-11 items-center tabular-nums transition-colors hover:text-accent lg:flex"
          >
            {receiptText(turns, lastAnswerCost)}
          </button>
        )}
        {/* No status light here any more (2026-10-22, Sidhant): with most of
            the telemetry gone, a "ready" dot beside Contact read as noise.
            The composer's placeholder says "loading" until hydration, and
            the polite status region announces each turn. */}
      </div>
    </header>
  );
}
