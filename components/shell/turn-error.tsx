"use client";

import {
  isRetryableClass,
  offersModelSwitch,
  turnErrorCopy,
  turnErrorLabel,
  type TurnErrorClass,
} from "@/lib/chat-telemetry";
import { MODEL_IDS, modelName } from "@/lib/models";

/**
 * The model a "different model" button offers: the next one after the current
 * selection in catalogue order, wrapping round.
 */
export function alternativeModel(current: string): string | null {
  const ids: readonly string[] = MODEL_IDS;
  if (ids.length < 2) return null;
  const at = ids.indexOf(current);
  return ids[(at === -1 ? 0 : at + 1) % ids.length] ?? null;
}

const BUTTON =
  "flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 text-[13px] text-text-soft transition-colors hover:border-accent hover:text-accent";

// A failed turn: a label naming the kind of failure, one class-specific
// sentence saying whose problem it is, and a button that sends the turn again.
// Shaped like the replay banner (accent rule, raised block), the site's form
// for "about the conversation, not part of it".
//
// The rate limit doesn't come through here: it isn't a failure, and ManualMode
// answers it instead.
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
      {/* No retry for `invalid_request`: resending would hit the identical
          rejection, so the visitor rewrites the turn instead (isRetryableClass).
          The model switch is offered only where the class sets `switchModel`
          in TURN_FAILURES; it also changes the selection, so the instruments
          panel's picker agrees with what answered. */}
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
              ask {modelName(alternative)} instead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
