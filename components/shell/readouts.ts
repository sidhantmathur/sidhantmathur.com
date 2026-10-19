import { formatUsd } from "@/lib/pricing";
import { modelName } from "@/lib/models";

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
    // The name a person uses, not the Gateway id (wave 2) — the rail sheet is
    // a recruiter's surface on a phone, not an instrument.
    model: modelName(model),
  };
}

/**
 * The header's one-line receipt (wave 2): turns used, and what the last
 * answer cost. Everything else the status strip used to carry — time to first
 * token, the rate needle, the session total, the hourly budget, the model
 * picker — is one click away in the instruments panel, which this opens.
 *
 * `lastCost` is null until an answer has been priced; the receipt then says
 * so with the same em dash every withheld readout on the site uses.
 */
export function receiptText(turns: number, lastCost: number | null): string {
  const used = `${turns}/${TURN_CAP} turns`;
  return `${used} · last answer ${lastCost == null ? "—" : formatUsd(lastCost)}`;
}
