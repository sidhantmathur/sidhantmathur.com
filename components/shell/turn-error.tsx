"use client";

import {
  isRetryableClass,
  offersModelSwitch,
  turnErrorCopy,
  turnErrorLabel,
  type TurnErrorClass,
} from "@/lib/chat-telemetry";
import { MODEL_IDS } from "@/lib/models";

/**
 * The model a "different model" button offers: the next one after the current
 * selection in catalogue order, wrapping round. Read off the catalogue rather
 * than named, so it follows whatever the default and the dropdown become —
 * from the default, it is the dropdown's second entry.
 */
export function alternativeModel(current: string): string | null {
  const ids: readonly string[] = MODEL_IDS;
  if (ids.length < 2) return null;
  const at = ids.indexOf(current);
  return ids[(at === -1 ? 0 : at + 1) % ids.length] ?? null;
}

const BUTTON =
  "flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 text-[13px] text-text-soft transition-colors hover:border-accent hover:text-accent";

// What a failed turn looks like.
//
// It used to be one grey sentence — "Something went wrong on my end" — for
// every class the route can produce, which made the site's most honest piece of
// engineering invisible at the one moment it mattered. The classes were already
// there, measured and logged; nothing rendered the difference.
//
// Three things, in the order a reader needs them:
//
//   the label   which turn, and what kind of failure, in the ledger's register
//               rather than in the vocabulary of an error code
//   the reason  one sentence, class-specific, saying whose problem this is
//   the way out a real button that sends the turn again
//
// Shaped like the replay banner above the conversation: an accent rule down the
// left and a raised block. That is the site's existing "this is about the
// conversation, not part of it" form, and a failed turn is exactly that.
//
// The rate-limit state does NOT come through here — it is not a failure, it is
// the budget, and ManualMode answers it with the corpus instead.
export function TurnError({
  errorClass,
  onRetry,
  model,
  onSwitchModel,
}: {
  /** Null only if a failure arrived with no class at all; treated as unknown. */
  errorClass: TurnErrorClass | null;
  onRetry: () => void;
  /** The model the turn ran on. Only read where the class offers a switch. */
  model?: string;
  /** Resend the turn on another model, selecting it in the same tap. */
  onSwitchModel?: (model: string) => void;
}) {
  const cls = errorClass ?? "unknown";
  const alternative =
    onSwitchModel && model && offersModelSwitch(cls) ? alternativeModel(model) : null;
  return (
    <div className="border-l-2 border-accent bg-raised px-3 py-2" role="alert">
      <p className="text-[12px] tracking-widest text-text-faint [font-family:var(--font-geist-mono)]">
        turn failed · {turnErrorLabel(cls)}
      </p>
      <p className="t-body mt-1.5 text-text-soft">{turnErrorCopy(cls)}</p>
      {/* Bordered like the suggested-question and citation chips, at their
          padding, because it is the same kind of object: the one thing there is
          to do next.

          Not rendered for every class. `invalid_request` is the one failure
          resending cannot fix — the button would send the identical message
          into the identical rejection — so it gets the sentence and no button,
          and the visitor rewrites the turn in the composer. See
          isRetryableClass. */}
      {/* A second way out for the one class where the model itself is the
          problem — see `switchModel` in the failure table. It resends the same
          question and changes the selection, so the header's picker agrees
          with what answered. Named by its model id, which is how the picker
          names it too. */}
      {(isRetryableClass(cls) || alternative) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {isRetryableClass(cls) && (
            <button
              type="button"
              // Wrapped: a bare handler would pass the click event through as
              // the retry's model.
              onClick={() => onRetry()}
              className={BUTTON}
            >
              try again
            </button>
          )}
          {alternative && onSwitchModel && (
            <button type="button" onClick={() => onSwitchModel(alternative)} className={BUTTON}>
              ask {alternative.split("/").pop()} instead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
