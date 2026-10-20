import { formatUsd } from "@/lib/pricing";
import { modelName } from "@/lib/models";

// The session readouts: turns used, time to first token, session cost, and
// which model is answering. This module holds the state and how it reads; the
// surfaces take the numbers and don't format them. The desktop header shows
// only `receiptText`; the full set renders at the bottom of the rail sheet in
// mobile-sheets.tsx.
//
// A readout with nothing behind it yet prints `—` rather than `0ms` or a blank:
// `0ms` would be a measurement, the dash is the absence of one. Not `formatMs`
// from lib/measurements.ts, which renders `123 ms` and `1.20 s`; these readouts
// render `123ms`.

/**
 * The conversation cap. Mirrors MAX_USER_MESSAGES in lib/models.ts, which the
 * chat route enforces with a graceful 429. Shown as a denominator so the limit
 * is visible before it is hit.
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
    // The name a person uses, not the Gateway id: the rail sheet is a
    // recruiter's surface on a phone, not an instrument.
    model: modelName(model),
  };
}

/**
 * The header's one-line receipt: turns used and what the last answer cost. The
 * header renders it as the button that opens the instruments panel, where the
 * rest of the readouts live. `lastCost` is null until an answer has been priced.
 */
export function receiptText(turns: number, lastCost: number | null): string {
  const used = `${turns}/${TURN_CAP} turns`;
  return `${used} · last answer ${lastCost == null ? "—" : formatUsd(lastCost)}`;
}
