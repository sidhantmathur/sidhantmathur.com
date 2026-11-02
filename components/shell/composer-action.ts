// What the composer's one button does: send a question, or stop the turn in
// flight. Free of React and the `@/` alias so the evals can load it under
// `node --test` (evals/composer-action.test.mjs).
//
// Stopping is read off the chat status alone, never off the phase line.
// `phaseOf` (lib/turn-phase.ts) goes null the moment prose is on screen, and the
// stop control used to live inside that line, so it vanished exactly when a
// reader could see the answer wasn't what they asked for (GitHub issue #3). The
// button sits where send was, so it never moves while the answer grows above
// it, and it is there from the moment a question is sent: beside a disabled
// send button it reads as the obvious control, not as a hint that something
// is wrong, which is what the old eight-second delay guarded against.

/** The useChat statuses a turn passes through. */
export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

/**
 * Whether the turn on screen can be stopped: from the moment it is sent until
 * the stream closes, whatever is or isn't on screen yet.
 */
export function canStop(status: string): boolean {
  return status === "submitted" || status === "streaming";
}

export type ComposerAction = { kind: "stop" } | { kind: "send"; disabled: boolean };

export function composerAction({
  stoppable,
  hydrated,
  hasText,
  full,
}: {
  /** `canStop(status)` for the turn on screen. */
  stoppable: boolean;
  /** Before hydration nothing can be sent, so the button says so. */
  hydrated: boolean;
  /** The composer holds something other than whitespace. */
  hasText: boolean;
  /** At the per-conversation question cap. */
  full: boolean;
}): ComposerAction {
  // A turn can only be in flight after hydration, so stop needs no gate of its
  // own. A half-typed follow-up doesn't take the button back: while a turn is
  // streaming, send couldn't do anything anyway.
  if (stoppable) return { kind: "stop" };
  return { kind: "send", disabled: !hydrated || !hasText || full };
}
