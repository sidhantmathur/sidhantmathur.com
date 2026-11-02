"use client";

import Link from "next/link";
import {
  RAIL_CONTACT_LABEL,
  RAIL_HOW,
  RAIL_WORK,
  SOCIAL_LINKS,
  type RailGroup,
  type RailItem,
} from "./shell-data";
import { downloadAs } from "@/lib/site";
import { EmailCopy } from "@/components/contact-actions";
import type { PanelView } from "./use-conversation";

// The index: the full destination list, rendered inside the index sheet,
// whose header carries the title.
export function RailContent({
  onOpenPanel,
  hydrated,
}: {
  onOpenPanel: (v: PanelView) => void;
  /** Rail entries with no href need JavaScript; see RailLink. */
  hydrated: boolean;
}) {
  const group = (g: RailGroup) => (
    <section key={g.label} aria-label={g.label} className="mt-5 first:mt-2">
      <h2 className="t-label text-text-faint">{g.label}</h2>
      <div className="mt-1 flex flex-col">
        {g.items.map((item) => (
          <RailLink key={item.label} item={item} onOpenPanel={onOpenPanel} hydrated={hydrated} />
        ))}
      </div>
    </section>
  );
  return (
    <>
      {group(RAIL_WORK)}
      {/* Drawn by the shell rather than listed: the address is on screen and
          copyable here too, as on the front door. */}
      <section aria-label={RAIL_CONTACT_LABEL} className="mt-5">
        <h2 className="t-label text-text-faint">{RAIL_CONTACT_LABEL}</h2>
        <div className="mt-2 flex flex-col">
          <EmailCopy surface="index" />
          {SOCIAL_LINKS.filter((s) => s.label !== "Email").map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[44px] items-center border-b border-line py-2 text-text-soft no-underline transition-colors hover:text-accent"
            >
              {s.label} ↗
            </a>
          ))}
        </div>
      </section>
      {group(RAIL_HOW)}
    </>
  );
}

function RailLink({
  item,
  onOpenPanel,
  hydrated,
}: {
  item: RailItem;
  onOpenPanel: (v: PanelView) => void;
  hydrated: boolean;
}) {
  // min-h plus items-center makes each row a full 44px target without changing
  // how it looks.
  const cls =
    "flex min-h-[44px] items-center border-b border-line py-2 text-left text-text-soft no-underline transition-colors hover:text-accent";

  // Hoisted so the click handlers close over a narrowed value — TypeScript
  // drops narrowing on a property once it crosses into a callback.
  const view = item.view;

  if (item.external && item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        {...downloadAs(item.href)}
        className={cls}
      >
        {item.label} ↗
      </a>
    );
  }

  // Rendered as a real anchor so cmd-click, middle-click and "open in new tab"
  // reach the standalone page, and so crawlers see a link. A plain left-click
  // is intercepted and opens the panel instead; usePanelUrl pushes the same
  // href into the address bar.
  if (view && item.href) {
    return (
      <a
        href={item.href}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onOpenPanel(view);
        }}
        className={cls}
      >
        {item.label} →
      </a>
    );
  }

  if (view) {
    return (
      // Entries with no page of their own can only open a panel, which needs
      // JavaScript. The anchors above still work before hydration by
      // navigating.
      <button
        type="button"
        onClick={() => onOpenPanel(view)}
        disabled={!hydrated}
        data-js-control
        className={cls}
      >
        {item.label}
      </button>
    );
  }

  return (
    <Link href={item.href ?? "/"} className={cls}>
      {item.label} →
    </Link>
  );
}
