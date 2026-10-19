// What a turn in flight is doing right now, read off the message as it streams.
//
// Moved here from components/shell/use-conversation.ts so `node --test` can
// load it (evals/turn-phase.test.mjs): that file imports React and the `@/`
// alias, and this needs neither. The hook re-exports everything here, so its
// callers read as before.
//
// `awaitingReply` alone left a hole. It goes false the moment an assistant
// message exists, but a message holding only a tool call and no text yet
// renders as nothing at all (app-shell skips messages with neither) — so a
// job-description turn, which spends its first step extracting requirements
// and its second judging them, showed a live indicator, then an empty column
// for the length of two model calls, then an answer.
//
// So the line reports the step instead of the wait. It stays ONE line, under
// the conversation, and it never becomes an expandable trace: the
// instrumentation policy puts density around the conversation, and a reasoning
// drawer in the message column is the thing that policy exists to refuse.
//
// The phases are read off the stream, not guessed on a timer. Nothing here
// claims work that isn't happening.
//
// TWO READINGS, BECAUSE THEY CHANGE AT DIFFERENT RATES (2026-10-19)
//
//   phaseOf     the step: one string that changes only when the turn moves to
//               a new step. The shell keys the line by this string, so a change
//               replays the line's entry, and it is the line's aria-live text,
//               so a change is announced. Both are right once per step and
//               wrong fourteen times in ten seconds.
//   activityOf  what the stream is doing inside that step, which can change
//               every chunk: hidden reasoning in progress, or the assessment's
//               rows arriving one by one. Rendered as an aria-hidden readout
//               beside the elapsed count, never folded into the step string.
//
// Why the second exists: on a pasted posting the two longest stretches are the
// model reasoning (reasoning-start, then nothing at all until reasoning-end —
// GPT-6 Luna streams no reasoning text) and the `roleFit` call's input
// streaming row by row. Measured on a 2,500-character posting at the provider
// default: 10 s of the first and 12 s of the second, with the line saying
// "writing the answer…" through the first. Both are real, both are on the
// stream, and neither was shown.

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

/** The default, and the string the site has always shown while a turn opens. */
export const OPENING_PHASE = "reading the resume…";

/** The gap between a finished tool call and the first token of the answer. */
export const WRITING_PHASE = "writing the answer…";

// --- A pasted job posting ---------------------------------------------------
//
// Three steps, each with its own name: extract, judge, then the sentence or two
// after the card. Short because they have to be. The line shares its row with
// the readout, the elapsed count and, after eight seconds, the stop button, and
// the shell is Geist Mono, so every character is 9px at 15px. Measured at 375px
// (2026-10-19): 343px of row, 124px of it fixed, so a label and its readout get
// 219px between them. "checking 14 requirements…" (225px) wrapped onto two lines
// on its own; "reading the job description…" (252px) wrapped once the readout
// joined it. The count the first one carried is in the readout instead (6/14),
// which is where something that changes every row belongs anyway.
//
// evals/turn-phase.test.mjs holds every step, with its widest readout, to that
// budget.

/** Before the stream opens and through the extraction step. */
export const JD_READING_PHASE = TOOL_PHASE["tool-extractRequirements"]!;

/**
 * From the moment extraction returns until the card is in. The reasoning in
 * between belongs to this step, not to the writing one.
 */
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
 * Is the turn in flight a pasted posting?
 *
 * The route's own answer when it has given one: the opening telemetry frame
 * carries `jobPosting`, and it is the first thing on the stream. Before that
 * frame exists — the whole "submitted" wait — the same detector the route runs,
 * on the same text the route will read. That is not a guess at what the server
 * will decide; it is the decision, made twice.
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
  // first streams: the model reasons in between, and that stretch belongs to
  // the judging step. Before this, it read "writing the answer…".
  if (fit || settled(extract)) return JD_CHECKING_PHASE;
  return JD_READING_PHASE;
}

/**
 * The one-line status for a turn in flight, or null once prose is on screen.
 * Once there is text to read, the reader has the answer — a status line under
 * it would be describing something they can already see.
 */
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

  // The most recent tool call that hasn't produced its output yet is the step
  // actually in flight. Reading from the end matters when one tool has already
  // finished by the time the next starts.
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
 *   reasoning  a reasoning part is open. The model is producing tokens the page
 *              will never show; on GPT-6 Luna not even their text arrives, only
 *              the part opening and, later, closing. This is the only proof on
 *              the stream that the silence is work.
 *   rows       the assessment's rows arriving, counted off the partial tool
 *              input as it streams, out of the requirements extracted. The row
 *              being written counts, so the first one reads 1 of N.
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
 * The readout's text: `thinking`, or `6/14`. "Thinking" rather than the
 * stream's own word: it is the reader's word for it, and 8px narrower on a
 * phone, which is the difference between one line and two.
 */
export function formatActivity(activity: PhaseActivity): string {
  return activity.kind === "reasoning" ? "thinking" : `${activity.done}/${activity.total}`;
}
