import { formatUsd } from "@/lib/pricing";

// The four numbers the shell shows about the session: turns used, time to
// first token, session cost, and which model is answering.
//
// They are rendered in two places — the desktop status strip in app-shell.tsx
// and, below lg where that strip is hidden, the bottom of the rail sheet in
// mobile-sheets.tsx. The strip formatted them and then handed the SHEET the
// finished strings as props, which meant the sheet's interface was four
// pre-rendered readouts and the sheet itself had no idea what a readout was.
// So: this module holds the state and how it reads, both surfaces take the
// numbers, and neither one formats.
//
// On the em dash. A readout with nothing behind it yet prints `—` rather than
// `0ms` or a blank, which is the same convention /measurements uses for a
// figure it is withholding (see lib/measurements.ts). `0ms` would be a
// measurement; the dash is the absence of one.
//
// `formatMs` in lib/measurements.ts is deliberately NOT used here. It renders
// `123 ms` and `1.20 s`; the strip has always rendered `123ms`, and quietly
// rewriting a visible readout to make an import line up is not a refactor.

/**
 * The conversation cap, mirrored from the graceful 429 in app/api/chat/route.ts
 * — the server is the one that enforces it. Shown as a denominator so the limit
 * is visible before it is hit rather than announced at the moment it is.
 */
export const TURN_CAP = 10;

export type ReadoutState = {
  /** User turns spent so far. */
  turns: number;
  /** Milliseconds to the first token of the last answer; null before one. */
  ttft: number | null;
  /** Session total in USD, estimated at list price. */
  cost: number;
  /** The model id as written in the catalogue. */
  model: string;
};

export type ReadoutValues = { turns: string; ttft: string; cost: string; model: string };

export function readoutValues({ turns, ttft, cost, model }: ReadoutState): ReadoutValues {
  return {
    turns: `${turns}/${TURN_CAP}`,
    ttft: ttft == null ? "—" : `${ttft}ms`,
    cost: formatUsd(cost),
    model,
  };
}
