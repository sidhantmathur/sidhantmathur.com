// What a turn in flight is doing right now, read off the message as it streams.
// Free of React and the `@/` alias so evals/turn-phase.test.mjs can load it
// under `node --test`; components/shell/use-conversation.ts re-exports
// `phaseOf` and `OPENING_PHASE`.
//
// The shell skips a message with no text and no tool output, so without this a
// job-posting turn shows an empty column for two model calls. The phase line
// reports the step, not the wait. Phases are read off the stream, never guessed on a
// timer, and the line stays one line under the conversation, never an
// expandable trace. Two readings, because they change at different rates:
//
//   phaseOf     the step. The shell keys the line by it and uses it as the
//               aria-live text, so each change replays the entry and is
//               announced.
//   activityOf  what the stream is doing inside the step, which can change
//               every chunk: hidden reasoning, or the assessment's rows
//               arriving. An aria-hidden readout, never part of the step.

import { looksLikeJobPosting } from "./job-posting.ts";

/** The shape this reads. Structural, so the evals can hand it plain objects. */
type Part = {
  type: string;
  state?: string;
  text?: string;
  input?: unknown;
  output?: unknown;
  data?: unknown;
};
type Message = { role: string; parts: readonly unknown[] };

const TOOL_PHASE: Record<string, string> = {
  "tool-extractRequirements": "reading the posting…",
  "tool-roleFit": "checking it against the record…",
  "tool-showProject": "pulling up the project…",
  "tool-showResume": "pulling up the resume…",
  "tool-contactCard": "finding the contact details…",
};

/** The default, shown while a turn opens. */
export const OPENING_PHASE = "reading the resume…";

/** The gap between a finished tool call and the first token of the answer. */
export const WRITING_PHASE = "writing the answer…";

// --- A pasted job posting ---------------------------------------------------
//
// Three steps: extract, judge, then the sentence or two after the card. The
// labels are short because the line shares a 375px row with the readout, the
// elapsed count and, after eight seconds, the stop button, in Geist Mono at 9px
// a character: a label and its readout get about 219px between them. A count
// that changes every row belongs in the readout (6/14), not the label.
// evals/turn-phase.test.mjs holds every step, with its widest readout, to that
// budget.

/** Before the stream opens and through the extraction step. */
export const JD_READING_PHASE = TOOL_PHASE["tool-extractRequirements"]!;

/** From the moment extraction returns until the card is in. */
export const JD_CHECKING_PHASE = "checking the fit…";

/** After the card is in, while the model writes what follows it. */
export const JD_WRITING_PHASE = "summarizing…";

// --- Reading the message ------------------------------------------------------

function partsOf(message: Message): Part[] {
  return message.parts.filter(
    (p): p is Part => typeof p === "object" && p !== null && typeof (p as Part).type === "string",
  );
}

function textOf(message: Message): string {
  return partsOf(message)
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

function lastPart(parts: Part[], type: string): Part | undefined {
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i]!.type === type) return parts[i];
  return undefined;
}

const settled = (p: Part | undefined) =>
  p?.state === "output-available" || p?.state === "output-error";

/**
 * Is the turn in flight a pasted posting? The route's own answer once the
 * opening telemetry frame (the first thing on the stream) carries `jobPosting`;
 * before that, the same detector the route runs, on the same text.
 */
export function isJobPostingTurn(messages: readonly Message[]): boolean {
  const last = messages[messages.length - 1];
  if (last?.role === "assistant") {
    const frame = lastPart(partsOf(last), "data-turn")?.data as { jobPosting?: unknown } | undefined;
    if (typeof frame?.jobPosting === "boolean") return frame.jobPosting;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return looksLikeJobPosting(textOf(messages[i]!));
  }
  return false;
}

/** How many requirements the extraction step returned, once it has. */
function extractedCount(parts: Part[]): number | null {
  const extract = lastPart(parts, "tool-extractRequirements");
  if (extract?.state !== "output-available") return null;
  const reqs = (extract.output as { requirements?: unknown } | undefined)?.requirements;
  return Array.isArray(reqs) ? reqs.length : null;
}

function jobPostingPhase(parts: Part[]): string {
  const fit = lastPart(parts, "tool-roleFit");
  if (fit && settled(fit)) return JD_WRITING_PHASE;
  const extract = lastPart(parts, "tool-extractRequirements");
  // Judging starts the moment extraction returns, not when the roleFit call
  // first streams: the model reasons in between, and that belongs to judging.
  if (fit || settled(extract)) return JD_CHECKING_PHASE;
  return JD_READING_PHASE;
}

/** The one-line status for a turn in flight, or null once prose is on screen. */
export function phaseOf(status: string, messages: readonly Message[]): string | null {
  const jobPosting = isJobPostingTurn(messages);
  const opening = jobPosting ? JD_READING_PHASE : OPENING_PHASE;
  if (status === "submitted") return opening;
  if (status !== "streaming") return null;

  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return opening;
  if (textOf(last).trim()) return null;

  const parts = partsOf(last);
  if (jobPosting) return jobPostingPhase(parts);

  // The most recent unsettled tool call is the step in flight; read from the
  // end because an earlier tool may already have finished.
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]!;
    if (!p.type.startsWith("tool-")) continue;
    if (settled(p)) break;
    return TOOL_PHASE[p.type] ?? OPENING_PHASE;
  }

  // A tool has returned and the model is composing around it.
  return parts.some((p) => p.type.startsWith("tool-")) ? WRITING_PHASE : OPENING_PHASE;
}

// --- Inside the step ------------------------------------------------------------

/**
 * What the stream is doing within the current step, when it is doing something
 * a reader can't otherwise see.
 *
 *   reasoning  a reasoning part is open. GPT-6 Luna streams no reasoning text,
 *              only the part opening and closing, so this is the only sign on
 *              the stream that the silence is work.
 *   rows       the assessment's rows arriving, counted off the partial tool
 *              input, out of the requirements extracted. The row being written
 *              counts, so the first one reads 1 of N.
 */
export type PhaseActivity =
  | { kind: "reasoning" }
  | { kind: "rows"; done: number; total: number };

export function activityOf(status: string, messages: readonly Message[]): PhaseActivity | null {
  if (status !== "streaming") return null;
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant" || textOf(last).trim()) return null;

  const parts = partsOf(last);
  if (parts.some((p) => p.type === "reasoning" && p.state === "streaming")) {
    return { kind: "reasoning" };
  }

  const fit = lastPart(parts, "tool-roleFit");
  if (fit?.state !== "input-streaming") return null;
  const total = extractedCount(parts);
  const input = fit.input as { rows?: unknown; requirements?: unknown } | undefined;
  // `requirements` is the alias the tool accepts for `rows` (see the route).
  const rows = Array.isArray(input?.rows)
    ? input.rows
    : Array.isArray(input?.requirements)
      ? input.requirements
      : null;
  if (!total || !rows?.length) return null;
  return { kind: "rows", done: Math.min(rows.length, total), total };
}

/** Same reading, for deciding whether a subscriber needs telling. */
export function sameActivity(a: PhaseActivity | null, b: PhaseActivity | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === "reasoning" || (b.kind === "rows" && a.done === b.done && a.total === b.total);
}

/**
 * The readout's text: `thinking`, or `6/14`. "Thinking" rather than
 * "reasoning": it is the reader's word, and one character narrower in a row
 * with no room to spare.
 */
export function formatActivity(activity: PhaseActivity): string {
  return activity.kind === "reasoning" ? "thinking" : `${activity.done}/${activity.total}`;
}
