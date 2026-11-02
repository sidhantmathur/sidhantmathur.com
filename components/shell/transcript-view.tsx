"use client";

import { Fragment, type ComponentType } from "react";
import { Answer } from "./answer";
import { CopyButton } from "./copy-button";
import { CitationChip } from "./citation-chip";
import { PhaseLine } from "./phase-line";
import { TurnError } from "./turn-error";
import { messageToMarkdown } from "@/lib/transcript";
import { RESUME_PDF, RESUME_PDF_FILENAME } from "@/lib/site";
import { MAX_USER_MESSAGES } from "@/lib/models";
import type { TurnErrorClass } from "@/lib/chat-telemetry";
import { textOf, toolOutputs, type ChatMessage, type PanelView } from "./use-conversation";

// The conversation itself: every turn as a ledger entry or an answer with its
// citations, then whatever the turn in flight is doing (the phase line), how it
// failed (TurnError, or manual mode when the budget is spent), and the notice
// at the conversation cap.

// Said when the per-conversation cap is reached, so it isn't mistaken for the
// hourly budget (ManualMode), which is a wait. This one is fixed by a tap.
const CONVERSATION_FULL = `That's ${MAX_USER_MESSAGES} questions, the most one conversation holds. Start a new one to keep asking — this one stays saved on the front page.`;
const CONVERSATION_FULL_ACTION = "Start a new conversation";

export function TranscriptView({
  messages,
  isBusy,
  lastId,
  phase,
  elapsed,
  errorKind,
  errorClass,
  model,
  onRetry,
  onSwitchModel,
  onOpenSource,
  ManualMode,
  rateLimitHeadline,
  full,
  onStartNew,
}: {
  messages: ChatMessage[];
  isBusy: boolean;
  /** The newest message's id: the one still streaming while a turn is busy. */
  lastId: string | undefined;
  phase: string | null;
  elapsed: number | null;
  errorKind: "none" | "error" | "rate_limited";
  errorClass: TurnErrorClass | null;
  model: string;
  onRetry: () => void;
  onSwitchModel: (model: string) => void;
  onOpenSource: (view: PanelView) => void;
  /** Loaded on demand by the shell; see the dynamic imports in app-shell.tsx. */
  ManualMode: ComponentType<{ headline: string; onOpenSource: (view: PanelView) => void }>;
  rateLimitHeadline: string;
  full: boolean;
  /** Home, then the composer: the conversation cap's one way forward. */
  onStartNew: () => void;
}) {
  return (
    <div className="space-y-6">
      {messages.map((m, mi) => {
        const text = textOf(m);
        const outs = toolOutputs(m);
        if (!text && !outs.length) return null;
        // Exchange number for the ledger rule — the count of user
        // turns up to and including this message.
        const exchange = messages
          .slice(0, mi + 1)
          .filter((x) => x.role === "user").length;
        return (
          // A turn resolves in (opacity plus a 4px blur clearing over
          // 400ms) rather than popping into the column. A CSS
          // animation restarts only when the animation property
          // changes, not on re-render, so the streaming turn isn't
          // re-blurred on every token.
          <div key={m.id} className="animate-stream-in space-y-2">
            {m.role === "user" ? (
              // A ledger entry, not a chat bubble: full width with a
              // numbered mono rule on top. A replayed turn isn't the
              // reader's own question, so it says "asked", not "you".
              <div className={mi > 0 ? "border-t border-line pt-4" : ""}>
                <p className="mb-2 t-label tracking-widest text-text-faint [font-family:var(--font-geist-mono)]">
                  {String(exchange).padStart(2, "0")} ·{" "}
                  {m.id.startsWith("replay-") ? "asked" : "you"}
                </p>
                <p className="t-body whitespace-pre-wrap border-l-2 border-accent pl-3 text-text">
                  {text}
                </p>
              </div>
            ) : (
              <>
                {/* The answer owns its own sources: markers out of
                    the prose, into the margin, and a source row
                    under it once the turn settles. */}
                <Answer
                  text={text}
                  settled={!isBusy || m.id !== lastId}
                  onOpenSource={onOpenSource}
                />
                {/* Tool citations and the copy button share one row.
                    The copy button is always visible, not revealed
                    on hover, because touch has no hover. */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {outs.map((o, i) => (
                    <Fragment key={i}>
                      <CitationChip
                        out={o}
                        latest={m.id === lastId}
                        onOpen={onOpenSource}
                      />
                      {/* The resume citation opens the panel; the
                          file also gets its own chip, a real
                          anchor, so it works whether or not the
                          model wrote a link. */}
                      {o.type === "tool-showResume" && (
                        <a
                          href={RESUME_PDF}
                          target="_blank"
                          rel="noreferrer"
                          download={RESUME_PDF_FILENAME}
                          className={`border px-3 py-2.5 t-meta no-underline transition-colors hover:border-accent hover:text-accent ${
                            m.id === lastId
                              ? "border-line-strong text-text-soft"
                              : "border-line text-text-faint"
                          }`}
                        >
                          ↓ PDF
                        </a>
                      )}
                    </Fragment>
                  ))}
                  {!isBusy && (
                    <CopyButton
                      getText={() => messageToMarkdown(m)}
                      label="copy"
                      event="chat_copy_message"
                      // Borderless, but it shares a row with the
                      // chips and has to be the same height to be
                      // aimed at alongside them.
                      className="flex touch-manipulation items-center px-1 py-2.5"
                    />
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Names the step rather than the wait. Keyed by phase so a step
          change restarts the entry animation; the elapsed count isn't
          keyed, so it measures the whole turn. The way out of a turn
          is the composer's button, not anything here: this line goes
          the moment prose arrives, and the answer is often where a
          reader decides they want out (issue #3). */}
      {phase && <PhaseLine key={phase} phase={phase} elapsed={elapsed} />}
      {errorKind === "error" && (
        <TurnError
          errorClass={errorClass}
          onRetry={onRetry}
          model={model}
          onSwitchModel={onSwitchModel}
        />
      )}
      {/* Out of turns: manual mode puts the corpus itself in the
          chat's place, with no model and no tokens. */}
      {errorKind === "rate_limited" && (
        <ManualMode headline={rateLimitHeadline} onOpenSource={onOpenSource} />
      )}
      {/* The conversation cap, said as itself rather than as the
          hourly budget, with the one tap that fixes it. */}
      {full && !isBusy && (
        <div className="space-y-3 border-l-2 border-accent bg-raised px-3 py-3">
          <p className="t-body text-text-soft">{CONVERSATION_FULL}</p>
          <button
            type="button"
            onClick={() => onStartNew()}
            data-js-control
            className="flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 text-[13px] text-text-soft transition-colors hover:border-accent hover:text-accent"
          >
            {CONVERSATION_FULL_ACTION}
          </button>
        </div>
      )}
    </div>
  );
}
