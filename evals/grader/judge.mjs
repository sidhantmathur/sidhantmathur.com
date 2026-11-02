// Judges: one that calls a model through the Vercel AI Gateway, and two that
// don't. Every judge is `async ({ id, instructions, prompt, row }) => ({ text,
// usage })`, so the runner, the budget and the tests never know which one they
// have.

import { checkClaim } from "../../lib/verify.ts";

/**
 * A model behind the Gateway. Retries are off: a retried call bills twice,
 * and the budget only sees one. The SDK is imported on first use, so a dry run
 * and the offline tests never load it.
 */
export function gatewayJudge({ model, maxOutputTokens, reasoning, timeoutMs = 60_000 }) {
  let sdk;
  return async ({ instructions, prompt }) => {
    sdk ??= await import("ai");
    const result = await sdk.generateText({
      model: sdk.gateway(model),
      instructions,
      prompt,
      maxOutputTokens,
      reasoning,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    return {
      text: result.text,
      usage: {
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        reasoningTokens: result.usage?.outputTokenDetails?.reasoningTokens,
      },
    };
  };
}

/** The account's Gateway balance in dollars, or null when it can't be read. */
export async function gatewayBalance() {
  try {
    const { gateway } = await import("ai");
    const credits = await gateway.getCredits();
    const balance = Number.parseFloat(credits.balance);
    const used = Number.parseFloat(credits.totalUsed);
    return Number.isFinite(balance) ? { balance, used: Number.isFinite(used) ? used : null } : null;
  } catch {
    return null;
  }
}

/** Replies fixed in advance, by row id. For the unit tests. */
export function scriptedJudge(replies, usage = { inputTokens: 400, outputTokens: 40 }) {
  return async ({ id }) => {
    const reply = replies[id];
    if (reply instanceof Error) throw reply;
    return { text: typeof reply === "function" ? reply() : (reply ?? ""), usage };
  };
}

// --- The heuristic stub -----------------------------------------------------
//
// A keyword baseline, so `--stub` runs the whole pipeline offline and prints a
// floor for the model to beat. It is not a judge: it reads words, not meaning.

const ABSENCE_CUE =
  /\b(?:does|did|has|have)(?:n['’]t|\s+not)\s+(?:\w+\s+)?(?:show|establish|demonstrat)\w*|\b(?:outside|not\s+in)\s+(?:the|his)\s+record\b|\b(?:key|main|biggest)\s+gaps?\b|\b(?:are|is)\s+(?:a\s+|the\s+)?gaps?\b/i;

/** Words that widen a claim, each paired with what the stub looks for in the source. */
const INFLATION_CUES = [
  /\b(?:owned|owns|own the|led a|led the|designs?|designed|administers?|administered|manages?|managed)\b/i,
  /\b(?:built every|every|all of|across all|the systems)\b/i,
  /\b(?:decided|drives|drove|generated|has cut|saved)\b/i,
  /\b(?:is live|since (?:19|20)\d\d|in under)\b/i,
];

export function heuristicJudge() {
  return async ({ row }) => {
    const sources = row.sources.map((s) => s.text).join("\n");
    const lookup = Object.fromEntries(row.sources.map((s) => [s.id, s]));
    let label = "supported";
    let reason = "every cue word and checkable token is in the source";
    if (ABSENCE_CUE.test(row.claim)) {
      label = "absence";
      reason = "the claim names what the record lacks";
    } else {
      const cue = INFLATION_CUES.map((re) => re.exec(row.claim)).find(
        (m) => m && !sources.toLowerCase().includes(m[0].toLowerCase()),
      );
      if (cue) {
        label = "overstated";
        reason = `"${cue[0]}" is not in the source`;
      } else {
        const check = checkClaim(row.claim, Object.keys(lookup), lookup);
        if (check.missing.length) {
          label = "unsupported";
          reason = `${check.missing.join(", ")} not in the source`;
        }
      }
    }
    return {
      text: JSON.stringify({ label, reason }),
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  };
}
