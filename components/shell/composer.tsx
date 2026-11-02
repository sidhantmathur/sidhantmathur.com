"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { SLASH_COMMANDS } from "./shell-data";
import { composerAction } from "./composer-action";
import type { PanelView } from "./use-conversation";

// The dock under the conversation: the slash menu, the composer itself, its
// fine print, and whatever the shell docks above and below the form (the
// continue row and the chips on the front door, the actions strip in a
// conversation). Owns what is typed; everything it sends goes through the
// shell's `ask`.

// Copy. Final strings come from docs/site-copy.md; drafted ones are logged in
// docs/copy-ledger.md.
//
// The empty state's desktop placeholder. The subline under the headline is
// POSITIONING from content/recruiter.ts, where the citation checker covers it.
const HERO_SUB = "Ask what you'd ask on a call";
// The composer's fine print, one line at each width. The full DISCLAIMER in
// lib/site.ts travels with exports.
const DISCLAIMER_SHORT = "AI answers can be wrong.";
const DISCLAIMER_LONG =
  "Answers cite their sources but can be wrong. The resume is the authoritative version.";
// Said when the per-conversation cap is reached; the notice in the transcript
// (transcript-view.tsx) says why and offers the way out.
const CONVERSATION_FULL_PLACEHOLDER = "This conversation is full";

export function Composer({
  inputRef,
  hydrated,
  full,
  isBusy,
  stoppable,
  onStop,
  hasMessages,
  isMobile,
  onAsk,
  onOpenPanel,
  above,
  below,
}: {
  /** Owned by the shell: the sheet's focus return and the full notice use it. */
  inputRef: RefObject<HTMLTextAreaElement | null>;
  hydrated: boolean;
  /** At the per-conversation question cap. */
  full: boolean;
  isBusy: boolean;
  /** The turn on screen can be stopped; see composer-action.ts. */
  stoppable: boolean;
  onStop: () => void;
  hasMessages: boolean;
  isMobile: boolean;
  /** The shell's `ask`: every way of asking goes through it. */
  onAsk: (text: string) => void;
  onOpenPanel: (view: PanelView) => void;
  /** Docked between the slash menu and the form. */
  above?: ReactNode;
  /** Docked under the fine print. */
  below?: ReactNode;
}) {
  const [input, setInput] = useState("");

  // The composer sizes itself to its content. Reset to auto first, because an
  // already-tall textarea reports its current height as scrollHeight and would
  // never shrink back after a paste is cleared. Runs on `input` rather than in
  // onChange so values set through setInput (slash commands, suggested
  // questions) get resized too.
  //
  // Math.max with offsetHeight, backed by a CSS min-height: an empty textarea
  // can report a scrollHeight computed against no content (before the font
  // swaps, or on a hydrated field's first paint), and writing that back would
  // lock the composer shorter than its placeholder. `auto` resolves against
  // the min-height, so the measurement never shrinks the field below it.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, el.offsetHeight)}px`;
  }, [input, inputRef]);

  const slashQuery = input.startsWith("/") ? input.toLowerCase() : null;
  const slashMatches = slashQuery
    ? SLASH_COMMANDS.filter((c) => c.name.startsWith(slashQuery))
    : [];

  function runSlash(name: string) {
    const cmd = SLASH_COMMANDS.find((c) => c.name === name);
    if (!cmd) return;
    setInput("");
    if (cmd.kind === "panel" && cmd.panel) return onOpenPanel({ kind: cmd.panel });
    if (cmd.message) onAsk(cmd.message);
  }

  function trySend() {
    const q = input.trim();
    if (!q) return;
    if (q.startsWith("/")) {
      const exact = SLASH_COMMANDS.find((c) => c.name === q);
      if (exact) return runSlash(exact.name);
      if (slashMatches.length === 1) return runSlash(slashMatches[0].name);
      return;
    }
    if (isBusy || full) return;
    onAsk(q);
    setInput("");
  }

  // The composer's one button: send, or stop while a turn is in flight. See
  // composer-action.ts for why stop lives here and not beside the phase line.
  const action = composerAction({ stoppable, hydrated, hasText: input.trim() !== "", full });
  const stopping = action.kind === "stop";
  // Stop turns back into a send that is disabled until something is typed, and
  // a disabled button drops focus on <body>. Keyboard focus on it when the turn
  // ends, by stop or by finishing, goes to the composer instead. Only keyboard
  // focus: handing a tap's focus to the textarea would raise a phone keyboard.
  const actionRef = useRef<HTMLButtonElement>(null);
  const actionKeyboardFocus = useRef(false);
  useEffect(() => {
    if (stoppable || !actionKeyboardFocus.current) return;
    actionKeyboardFocus.current = false;
    const active = document.activeElement;
    if (active == null || active === document.body || active === actionRef.current) {
      inputRef.current?.focus();
    }
  }, [stoppable, inputRef]);

  return (
    // Input. The bottom padding keeps the row clear of the home indicator on
    // notched iPhones; it resolves to 0 elsewhere.
    <div className="relative shrink-0 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]">
      {slashMatches.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 border-t border-line bg-panel">
          {slashMatches.map((c) => (
            <button
              key={c.name}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runSlash(c.name);
              }}
              data-js-control
              className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left t-meta hover:bg-raised md:px-10"
            >
              <span className="text-accent">{c.name}</span>
              <span className="text-text-faint">{c.hint}</span>
            </button>
          ))}
        </div>
      )}
      {above}
      <form
        // No native submit, ever. A form with no action submits by
        // navigating to the current URL with the fields in the query
        // string, and disabling the button doesn't stop
        // `requestSubmit()` from an extension or future code. Per the
        // HTML submit algorithm, a method="dialog" form outside a
        // <dialog> does nothing on submit but still fires the submit
        // event, so Enter still sends and the page can't navigate
        // whether the JavaScript has arrived, hasn't yet, or threw.
        method="dialog"
        // The composer grows, so the height is a floor, and the prompt
        // aligns to the first line rather than the middle of a long
        // paste.
        className="flex min-h-12 items-start px-4 text-[15px] md:px-10"
        onSubmit={(e) => {
          e.preventDefault();
          trySend();
        }}
      >
        <span className="py-3 text-[15px] leading-[1.6] text-accent">&gt;</span>
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              trySend();
            }
            if (e.key === "Escape") setInput("");
          }}
          id="ask"
          // Disabled until hydration: the page can't send a question
          // yet, and a field that can't be typed into can't fire an
          // implicit submit on Enter.
          // Also off at the conversation cap, where the placeholder and
          // the notice above say why: a field that takes a question it
          // can't send is a dead end.
          disabled={!hydrated || full}
          // Phones and conversations get the short placeholder, which
          // survives a 320px screen; the empty state on a desktop gets
          // HERO_SUB. isMobile is settled by the time hydration lifts
          // this gate. The slash menu advertises itself once "/" is
          // typed.
          placeholder={
            !hydrated
              ? "Loading the conversation…"
              : full
                ? CONVERSATION_FULL_PLACEHOLDER
                : hasMessages || isMobile
                  ? "Ask a question"
                  : HERO_SUB
          }
          aria-label="Ask a question"
          enterKeyHint="send"
          // 16px below md because iOS Safari zooms into any focused field
          // under 16px and doesn't zoom back out; maximum-scale=1 would
          // fix that only by disabling pinch-zoom for everyone.
          //
          // The field carries the row's vertical padding, so a one-line
          // composer is a full 48px tap target. max-h caps growth at
          // eight lines and scrolls past that, so a long pasted posting
          // doesn't swallow the conversation.
          className={`ml-2 max-h-[216px] min-h-[48px] min-w-0 flex-1 resize-none bg-transparent py-3 text-[16px] leading-[1.6] text-text outline-none placeholder:text-text-faint disabled:placeholder:text-text-dim md:text-[15px] ${
            full ? "disabled:cursor-not-allowed" : "disabled:cursor-progress"
          }`}
        />
        {/* One control at every width: bordered, labelled, 44px tall and
            legible when disabled. It sends, and while a turn is in
            flight it stops it, in the same place, so the way out never
            moves as the answer grows above it. my-1.5 centres it on the
            first line of a growing field.

            One element in both states, so keyboard focus survives the
            swap, and both labels always laid out in one grid cell, the
            idle one hidden, so the box is the same size either way. */}
        <button
          ref={actionRef}
          type={stopping ? "button" : "submit"}
          onClick={
            stopping
              ? (e) => {
                  // The second click of a double-click on send lands
                  // here once the first has sent, and must not stop the
                  // turn it just started. A key press has a detail of 0.
                  if (e.detail > 1) return;
                  onStop();
                }
              : undefined
          }
          // Disabled until hydration, so a press before the JavaScript
          // arrives shows it can't send yet rather than silently doing
          // nothing. Stop is never disabled.
          disabled={action.kind === "send" && action.disabled}
          onFocus={(e) => {
            actionKeyboardFocus.current = e.currentTarget.matches(":focus-visible");
          }}
          onBlur={(e) => {
            if (e.relatedTarget) actionKeyboardFocus.current = false;
          }}
          className="-mr-1.5 my-1.5 ml-2 disabled:cursor-progress flex h-11 min-w-[44px] shrink-0 touch-manipulation items-center justify-center border border-line-strong bg-raised px-3 t-meta text-text-soft transition-colors hover:border-accent hover:text-accent disabled:border-line disabled:text-text-dim"
        >
          <span className="grid">
            <span
              aria-hidden={stopping || undefined}
              className={`col-start-1 row-start-1 ${stopping ? "invisible" : ""}`}
            >
              send ↵
            </span>
            <span
              aria-hidden={!stopping || undefined}
              className={`col-start-1 row-start-1 flex items-center justify-center ${
                stopping ? "" : "invisible"
              }`}
            >
              stop
              {/* Drawn, like the index button's trigram: a Unicode
                  square falls back to another font and another width. */}
              <svg
                width="8"
                height="8"
                viewBox="0 0 8 8"
                aria-hidden="true"
                className="ml-[0.6ch] shrink-0"
              >
                <rect width="8" height="8" fill="currentColor" />
              </svg>
            </span>
          </span>
        </button>
      </form>

      {/* One line of fine print and a link to the colophon, which
          carries the credibility claims. A phone gets the short
          sentence because the long one wraps to two lines at 390px.
          Gone once a conversation starts: answers then carry their own
          sources, and the actions strip takes this row. */}
      {!hasMessages && (
        <p className="t-label px-4 pb-2.5 text-text-faint md:px-10">
          <span className="lg:hidden">{DISCLAIMER_SHORT}</span>
          <span className="hidden lg:inline">{DISCLAIMER_LONG}</span>{" "}
          <Link
            href="/colophon"
            className="-my-2 py-2 text-text-soft underline decoration-line-strong underline-offset-2 hover:text-accent"
          >
            How it works
          </Link>
        </p>
      )}

      {below}
    </div>
  );
}
