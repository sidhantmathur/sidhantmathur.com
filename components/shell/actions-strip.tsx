"use client";

import { useState } from "react";
import { CopyButton } from "./copy-button";

// ---- Actions strip ---------------------------------------
// Quiet and present from the first turn; it gains a little
// weight after an action instead of interrupting. Scrolls
// horizontally rather than wrapping on a narrow phone, so the
// input row above never moves.
export function ActionsStrip({
  hasMessages,
  emphasis,
  hydrated,
  getMarkdown,
  onAction,
  onExport,
  onCopyLink,
  onPasteJd,
}: {
  hasMessages: boolean;
  /** The few seconds after an action; see useStripEmphasis. */
  emphasis: boolean;
  hydrated: boolean;
  /** The conversation as the strip, the export panel and the rail copy it. */
  getMarkdown: () => string;
  /** Called after a copy, to give the strip its emphasis. */
  onAction: () => void;
  onExport: () => void;
  /** Resolves true when the link reached the clipboard. */
  onCopyLink: () => Promise<boolean>;
  onPasteJd: () => void;
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  return (
    <div
      // The fade is the only sign this row scrolls; a phone shows no
      // scrollbar.
      style={{
        maskImage: "linear-gradient(to right, black 85%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, black 85%, transparent)",
      }}
      // Conversation-only: the empty state's dock carries the chips and
      // the fine print instead. Pasting a posting straight into the
      // composer works too; the route's detector, not this entry,
      // starts the job-posting flow.
      className={`h-11 items-center gap-4 overflow-x-auto whitespace-nowrap border-t px-4 t-meta transition-colors md:px-10 ${
        hasMessages ? "flex" : "hidden"
      } ${emphasis ? "border-accent" : "border-line"}`}
    >
      {hasMessages && (
        <>
          <CopyButton
            getText={getMarkdown}
            label="copy"
            copiedLabel="copied"
            event="chat_copy_conversation"
            // focus-inset for the same reason the strip's other
            // buttons carry it: this row scrolls horizontally, and a
            // ring drawn outside the control is clipped at either end.
            className={`focus-inset flex h-full shrink-0 touch-manipulation items-center ${
              emphasis ? "text-text-soft" : ""
            }`}
            onCopied={onAction}
          />
          <StripButton label="export" emphasis={emphasis} onClick={onExport} />
          <StripButton
            label={linkCopied ? "link copied" : "link"}
            emphasis={emphasis}
            onClick={() => {
              void onCopyLink().then((ok) => {
                if (!ok) return;
                setLinkCopied(true);
                window.setTimeout(() => setLinkCopied(false), 1600);
              });
            }}
          />
        </>
      )}
      <StripButton
        label="paste a job description"
        emphasis={emphasis}
        onClick={onPasteJd}
        disabled={!hydrated}
        // Desktop only; on a phone the index entry is the way in.
        className="hidden md:flex"
      />
      {/* No "reset" here any more: the way out is Home in the
          conversation bar, and it keeps the conversation to continue
          rather than deleting it from the bottom corner. */}
    </div>
  );
}

// One action in the strip. Emphasis is a colour step, not a new element, so
// the strip is the same shape before and after.
function StripButton({
  label,
  emphasis,
  onClick,
  disabled,
  className = "flex",
}: {
  label: string;
  emphasis: boolean;
  onClick: () => void;
  /** Only the job-description entry is on screen before hydration. */
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-js-control
      // Full-height, so the hit area is the 44px strip rather than the text.
      className={`${className} focus-inset h-full shrink-0 touch-manipulation items-center transition-colors hover:text-accent ${
        emphasis ? "text-text-soft" : "text-text-faint"
      }`}
    >
      {label}
    </button>
  );
}
