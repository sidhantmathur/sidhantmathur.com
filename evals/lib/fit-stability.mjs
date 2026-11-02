// The fit-check stability harness, minus its command line: what one turn
// sends, how its stream is read, how rows are matched across repeats, the
// agreement arithmetic, and the spend guard. scripts/run-fit-stability.mjs and
// scripts/report-fit-stability.mjs are thin shells around this file, and
// evals/fit-stability.test.mjs holds it to hand-built cases.
//
// See docs/fit-check-at-scale.md for the design and the numbers.

import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { JD_PREFIX, MAX_USER_TEXT, looksLikeJobPosting } from "../../lib/job-posting.ts";
import { DEFAULT_MODEL, MODELS, maxOutputTokensFor, reasoningFor } from "../../lib/models.ts";
import { CONSISTENCY_SAMPLES } from "../../lib/consistency.ts";
import { MODEL_PRICES, PRICE_CONFIDENCE, costOfTurn } from "../../lib/pricing.ts";
import { checkablePart } from "../../lib/role-fit.ts";
import { checkClaim, verifyAnswer } from "../../lib/verify.ts";
import { STREAM_IDLE_TIMEOUT_MS } from "../../lib/chat-transport.ts";
import { hash32, pastedAsSent } from "./postings.mjs";

// --- The corpus -------------------------------------------------------------

/**
 * Reads a JSONL corpus, gzipped or not. Every line needs `text`; an entry
 * without an id gets one from its text, so a hand-pasted line in
 * evals/postings/mine.jsonl is enough. Blank lines are skipped.
 */
export function readCorpus(path) {
  const candidates = [path, `${path}.gz`, path.replace(/\.gz$/, "")];
  const file = candidates.find((p) => existsSync(p));
  if (!file) throw new Error(`No corpus at ${path}`);
  const raw = readFileSync(file);
  const text = file.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  const postings = [];
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    let p;
    try {
      p = JSON.parse(line);
    } catch {
      throw new Error(`${file}:${i + 1} is not JSON`);
    }
    if (typeof p.text !== "string" || !p.text.trim()) throw new Error(`${file}:${i + 1} has no text`);
    postings.push({
      id: p.id ?? `adhoc:${hash32(p.text).toString(16)}`,
      company: p.company ?? "",
      title: p.title ?? "",
      family: p.family ?? null,
      control: p.control ?? "none",
      controlKind: p.controlKind ?? null,
      ...p,
      length: p.text.length,
    });
  });
  return { file, postings };
}

/** The stratum a posting is sampled and reported in. */
export function stratumOf(p) {
  return p.control && p.control !== "none" ? p.control : p.family ?? "unlabelled";
}

/**
 * Picks the postings for a run. Filters first (`ids`, `families`, `controls`),
 * then either `perStratum` postings from each stratum or a `sample` spread
 * across strata in proportion (at least one from each). Deterministic for a
 * given `seed`, so a resumed run selects the same postings.
 */
export function selectPostings(postings, { ids, families, controls, perStratum, sample, limit, seed = "fit" } = {}) {
  let pool = postings;
  if (ids?.length) pool = pool.filter((p) => ids.includes(p.id));
  if (families?.length) pool = pool.filter((p) => families.includes(p.family));
  if (controls?.length) pool = pool.filter((p) => controls.includes(p.control ?? "none"));
  const ordered = [...pool].sort((a, b) => hash32(`${seed}|${a.id}`) - hash32(`${seed}|${b.id}`));

  let chosen = ordered;
  if (perStratum || sample) {
    const strata = new Map();
    for (const p of ordered) {
      const key = stratumOf(p);
      if (!strata.has(key)) strata.set(key, []);
      strata.get(key).push(p);
    }
    const quota = new Map();
    if (perStratum) {
      for (const [k, list] of strata) quota.set(k, Math.min(perStratum, list.length));
    } else {
      const total = ordered.length;
      for (const [k, list] of strata) quota.set(k, Math.min(list.length, Math.max(1, Math.round((sample * list.length) / total))));
    }
    chosen = [...strata].flatMap(([k, list]) => list.slice(0, quota.get(k)));
  }
  if (limit) chosen = chosen.slice(0, limit);
  // Report order: by stratum, then the corpus's own order.
  const index = new Map(postings.map((p, i) => [p.id, i]));
  return chosen.sort((a, b) => index.get(a.id) - index.get(b.id));
}

// --- What one turn sends -----------------------------------------------------

/**
 * The request body the paste panel produces for one posting, in a fresh
 * conversation: JobDescriptionForm cuts the paste at MAX_POSTING_TEXT and
 * trims it, submitJd prepends JD_PREFIX and a blank line, submit() trims
 * again, and useChat's DefaultChatTransport posts the conversation with the
 * selected model in the body (components/shell/panel-body.tsx,
 * app-shell.tsx, use-conversation.ts).
 */
export function jdRequestBody({ posting, model, chatId, messageId }) {
  const text = `${JD_PREFIX}\n\n${pastedAsSent(posting)}`.trim();
  return {
    id: chatId,
    messages: [{ id: messageId, role: "user", parts: [{ type: "text", text }] }],
    trigger: "submit-message",
    model,
  };
}

/** The text a body carries, for the invariants the tests check. */
export function bodyText(body) {
  return body.messages.at(-1).parts.map((p) => p.text).join("\n");
}

export function assertSendable(body) {
  const text = bodyText(body);
  if (text.length > MAX_USER_TEXT) throw new Error(`turn is ${text.length} chars, over the route's ${MAX_USER_TEXT}`);
  if (!looksLikeJobPosting(text)) throw new Error("the route would not treat this turn as a posting");
}

/** What a reasoning level is called in results: the catalogue's own, or the provider's default. */
export function effectiveReasoning(model, requested) {
  if (requested && requested !== "catalogue") return requested;
  return reasoningFor(model in MODELS ? model : DEFAULT_MODEL, { jobPosting: true }) ?? "provider-default";
}

export function cellKey({ postingId, model, reasoning, repeat }) {
  return `${postingId}|${model}|${reasoning}|${repeat}`;
}

/** Every turn a run would send, in the order it sends them: repeat-major, so an early stop still has whole repeats. */
export function planCells({ postings, models, reasonings, repeats }) {
  const cells = [];
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    for (const model of models) {
      for (const requested of reasonings) {
        const reasoning = effectiveReasoning(model, requested);
        for (const posting of postings) {
          cells.push({ posting, postingId: posting.id, model, requested, reasoning, repeat, key: cellKey({ postingId: posting.id, model, reasoning, repeat }) });
        }
      }
    }
  }
  return cells;
}

// --- Reading the stream ------------------------------------------------------

/**
 * Reads the route's UI message stream (SSE) as it arrives, timing each event
 * from when the request was sent. Fed text chunks in any split: a line cut in
 * two across reads is joined before it's parsed.
 */
export function createStreamReader() {
  let buffer = "";
  const state = {
    events: 0,
    firstChunkAt: null,
    lastChunkAt: null,
    maxGapMs: 0,
    text: "",
    firstTextAt: null,
    reasoningChars: 0,
    reasoningStartAt: null,
    tools: new Map(),
    toolOrder: [],
    telemetryOpening: null,
    telemetry: null,
    streamError: null,
    finishSeen: false,
    done: false,
    endedAt: null,
  };

  function tool(id, name, at) {
    if (!state.tools.has(id)) {
      state.tools.set(id, { toolCallId: id, toolName: name ?? null, inputStartAt: at, inputAvailableAt: null, outputAt: null, input: null, output: null, error: null });
      state.toolOrder.push(id);
    }
    const t = state.tools.get(id);
    if (name && !t.toolName) t.toolName = name;
    return t;
  }

  function handle(event, at) {
    state.events += 1;
    const type = typeof event.type === "string" ? event.type : "";
    switch (type) {
      case "text-delta":
        if (typeof event.delta === "string") {
          if (state.firstTextAt == null && event.delta.trim()) state.firstTextAt = at;
          state.text += event.delta;
        }
        break;
      case "reasoning-start":
        if (state.reasoningStartAt == null) state.reasoningStartAt = at;
        break;
      case "reasoning-delta":
        if (typeof event.delta === "string") state.reasoningChars += event.delta.length;
        break;
      case "tool-input-start":
        tool(event.toolCallId, event.toolName, at);
        break;
      case "tool-input-available": {
        const t = tool(event.toolCallId, event.toolName, at);
        t.inputAvailableAt = at;
        t.input = event.input ?? null;
        break;
      }
      case "tool-input-error":
      case "tool-output-error": {
        const t = tool(event.toolCallId, event.toolName, at);
        t.error = event.errorText ?? "error";
        break;
      }
      case "tool-output-available": {
        const t = tool(event.toolCallId, event.toolName, at);
        t.outputAt = at;
        t.output = event.output ?? null;
        break;
      }
      case "data-turn":
        if (event.data && typeof event.data === "object") {
          if (!state.telemetryOpening) state.telemetryOpening = event.data;
          state.telemetry = event.data;
        }
        break;
      case "error":
        state.streamError = typeof event.errorText === "string" ? event.errorText : "error";
        break;
      case "finish":
        state.finishSeen = true;
        break;
      default:
        break;
    }
  }

  function line(raw, at) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload) return;
    if (payload === "[DONE]") {
      state.done = true;
      return;
    }
    try {
      handle(JSON.parse(payload), at);
    } catch {
      /* a malformed line is skipped, not fatal */
    }
  }

  return {
    feed(chunk, at) {
      if (state.firstChunkAt == null) state.firstChunkAt = at;
      if (state.lastChunkAt != null) state.maxGapMs = Math.max(state.maxGapMs, at - state.lastChunkAt);
      state.lastChunkAt = at;
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        line(buffer.slice(0, nl), at);
        buffer = buffer.slice(nl + 1);
      }
    },
    end(at) {
      if (buffer) line(buffer, at);
      buffer = "";
      state.endedAt = at;
      return this.result();
    },
    result() {
      return { ...state, tools: state.toolOrder.map((id) => state.tools.get(id)) };
    },
  };
}

// --- One turn, measured ------------------------------------------------------

const round = (ms) => (ms == null ? null : Math.round(ms));

/**
 * Runs one turn against `${base}/api/chat` and returns what was measured. Never
 * throws for a failure the server or network produced: those come back as a
 * status, because a broken turn is a result to record, not a crash.
 */
export async function runTurn({ base, body, headers = {}, timeoutMs = 120_000, fetchImpl = fetch, now = () => performance.now() }) {
  const t0 = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    return {
      status: err.name === "AbortError" ? "timeout" : "transport-error",
      error: err.cause?.code ?? err.message,
      reachedServer: false,
    };
  }
  const ttfbMs = now() - t0;
  const meta = {
    httpStatus: res.status,
    modelHeader: res.headers.get("x-model"),
    budgetRemaining: res.headers.get("x-budget-remaining"),
    ttfbMs: round(ttfbMs),
    reachedServer: true,
    // Set only by evals/lib/mock-chat-server.mjs, so a mock run can never be
    // reported as a measurement.
    mock: res.headers.get("x-mock-chat"),
  };
  if (!res.ok) {
    clearTimeout(timer);
    const raw = await res.text().catch(() => "");
    let errorClass = null;
    try {
      errorClass = JSON.parse(raw).error ?? null;
    } catch {
      /* not JSON */
    }
    return { status: "http-error", error: errorClass ?? raw.slice(0, 120), errorClass, ...meta };
  }

  const reader = createStreamReader();
  const decoder = new TextDecoder();
  let status = "ok";
  let error = null;
  try {
    for await (const chunk of res.body) reader.feed(decoder.decode(chunk, { stream: true }), now() - t0);
  } catch (err) {
    status = err.name === "AbortError" ? "timeout" : "transport-error";
    error = err.message;
  } finally {
    clearTimeout(timer);
  }
  const stream = reader.end(now() - t0);
  if (status === "ok" && stream.streamError) {
    status = "stream-error";
    error = stream.streamError;
  }
  return { status, error, ...meta, stream };
}

/**
 * What the record keeps of a turn: the tool calls, the reconciled rows, the
 * verify pass the site would render, timings, tokens and cost.
 *
 * `lookup` is the chunk corpus the site checks citations against (record and
 * repo chunks, as lib/corpus.ts builds ALL_CHUNKS_BY_ID).
 */
export function summarizeTurn(turn, { model, lookup }) {
  const stream = turn.stream ?? null;
  const tools = stream?.tools ?? [];
  const extractCalls = tools.filter((t) => t.toolName === "extractRequirements");
  const roleFitCalls = tools.filter((t) => t.toolName === "roleFit");
  const extract = extractCalls.find((t) => t.output) ?? null;
  // The card a visitor reads is the first roleFit result; a second one (a
  // model retrying) renders as a second card, counted in roleFitCalls.
  const card = roleFitCalls.find((t) => t.output && Array.isArray(t.output.rows)) ?? null;
  const telemetry = stream?.telemetry ?? null;
  const usage = telemetry?.usage ?? null;
  const served = telemetry?.model ?? turn.modelHeader ?? model;
  const cost = usage ? costOfTurn(served, usage) : null;

  const extracted = Array.isArray(extract?.output?.requirements) ? extract.output.requirements : [];
  const rows = Array.isArray(card?.output?.rows)
    ? card.output.rows.map((r) => ({
        requirement: String(r?.requirement ?? ""),
        verdict: r?.verdict ?? "unclear",
        claimedVerdict: r?.claimedVerdict ?? null,
        downgrade: r?.downgrade ?? null,
        sources: Array.isArray(r?.sources) ? r.sources : [],
        unknownSources: Array.isArray(r?.unknownSources) ? r.unknownSources : [],
        unverified: Array.isArray(r?.unverified) ? r.unverified : [],
        evidence: String(r?.evidence ?? ""),
      }))
    : [];

  // The verify pass, re-run here with lib/verify.ts over what the card shows,
  // so the number doesn't depend on which corpus the server had.
  let positiveRows = 0;
  let positiveVerified = 0;
  for (const r of rows) {
    if (r.verdict !== "met" && r.verdict !== "partial") continue;
    positiveRows += 1;
    const check = checkClaim(checkablePart(r.evidence, r.verdict), [...r.sources, ...r.unknownSources], lookup);
    const marked = check.ids.length === 0 || check.unknownIds.length > 0 || check.missing.length > 0;
    if (!marked) positiveVerified += 1;
  }
  const answer = stream?.text ?? "";
  const prose = answer ? verifyAnswer(answer, lookup) : null;
  const countVerdict = (v) => prose?.claims.filter((c) => c.verdict === v).length ?? 0;

  const tExtracted = extract?.outputAt ?? null;
  const tCard = card?.outputAt ?? null;
  const blank = !card && !answer.trim();
  const counts = card?.output?.counts ?? null;

  return {
    status: turn.status,
    mock: turn.mock ?? null,
    httpStatus: turn.httpStatus ?? null,
    error: turn.error ?? null,
    modelServed: served,
    calledExtract: extractCalls.length > 0,
    calledRoleFit: roleFitCalls.length > 0,
    extractCalls: extractCalls.length,
    roleFitCalls: roleFitCalls.length,
    toolErrors: tools.filter((t) => t.error).map((t) => `${t.toolName}: ${t.error}`),
    requirementCount: extract ? extracted.length : null,
    extracted,
    rows,
    counts,
    gapsCount: Array.isArray(card?.output?.gaps) ? card.output.gaps.length : null,
    uncovered: card?.output?.uncovered ?? null,
    downgraded: card?.output?.downgraded ?? null,
    blank,
    timings: {
      ttfbMs: turn.ttfbMs ?? null,
      extractStartMs: round(extract?.inputStartAt),
      extractedMs: round(tExtracted),
      cardStartMs: round(card?.inputStartAt),
      cardMs: round(tCard),
      firstTextMs: round(stream?.firstTextAt),
      doneMs: round(stream?.endedAt),
      maxGapMs: round(stream?.maxGapMs),
      // The browser's transport fails a turn that goes quiet this long.
      wouldStall: stream ? stream.maxGapMs > STREAM_IDLE_TIMEOUT_MS : null,
    },
    telemetry: telemetry
      ? {
          finishReason: telemetry.finishReason ?? null,
          steps: telemetry.steps ?? null,
          toolsCalled: telemetry.toolsCalled ?? null,
          usage,
          serverTiming: telemetry.timing ?? null,
          errorClass: telemetry.error?.class ?? null,
          jobPosting: telemetry.jobPosting ?? null,
        }
      : null,
    costUsd: cost ? cost.total : null,
    citations: {
      positiveRows,
      positiveVerified,
      uncitedDowngrades: rows.filter((r) => r.downgrade === "uncited").length,
      unknownIds: [...new Set([...rows.flatMap((r) => r.unknownSources), ...(prose?.unknownIds ?? [])])],
      answerClaims: prose?.claims.length ?? 0,
      answerVerified: prose?.verified ?? 0,
      answerVerdicts: {
        verified: countVerdict("verified"),
        miscited: countVerdict("miscited"),
        unverified: countVerdict("unverified"),
        uncited: countVerdict("uncited"),
      },
    },
    reasoningChars: stream?.reasoningChars ?? 0,
    answerChars: answer.length,
    answer,
  };
}

// --- Matching rows across repeats --------------------------------------------
//
// A row is identified by its requirement text: the posting's words, copied by
// the extraction step. Across repeats the extraction can trim a bullet, split
// or merge two, or reorder, so exact matching undercounts agreement. The
// method, in order:
//
//   1. Normalize: lowercase, strip bullets and punctuation, collapse spaces.
//      Equal normalized text is a match (score 1).
//   2. Otherwise compare content words (stopwords out, plurals folded): the
//      Dice overlap, or, when the smaller side has 3+ content words, the share
//      of the smaller side found in the larger (a trimmed copy of the same
//      bullet), discounted to 0.9 so an exact pair always outranks it.
//   3. Pair rows one-to-one, best score first, at or above MATCH_THRESHOLD.
//
// Across N repeats the rows are clustered: each repeat's rows join the
// clusters built so far, scored against every member already in the cluster,
// at most one row per repeat per cluster. A row that joins nothing starts its
// own cluster. A cluster is one requirement as the repeats saw it.

export const MATCH_THRESHOLD = 0.5;

const REQ_STOPWORDS = new Set(
  `a an the and or of to for in on with at by as is are be you your our we they their it its
   this that these those will would can could should must may who what which how from into
   across within about over per via etc e g ie i.e e.g including include includes such like
   ability able strong deep excellent proven demonstrated solid great good
   experience experienced years year plus least minimum ideally preferred required bonus nice
   have has having own owning owned work working`
    .split(/\s+/)
    .filter(Boolean),
);

export function normalizeRequirement(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/^[\s\-•*·▪◦●\d.)]+/, "")
    .replace(/[^a-z0-9+#&%$ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fold(word) {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function requirementWords(text) {
  return [...new Set(normalizeRequirement(text).split(" ").filter((w) => w && !REQ_STOPWORDS.has(w)).map(fold))];
}

/** How alike two requirement texts are, 0–1. */
export function requirementSimilarity(a, b) {
  const na = normalizeRequirement(a);
  const nb = normalizeRequirement(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const A = requirementWords(a);
  const B = new Set(requirementWords(b));
  if (!A.length || !B.size) return 0;
  const shared = A.filter((w) => B.has(w)).length;
  const dice = (2 * shared) / (A.length + B.size);
  const small = Math.min(A.length, B.size);
  const containment = small >= 3 ? (0.9 * shared) / small : 0;
  return Math.max(dice, containment);
}

/** One-to-one pairs between two row lists, best first. Returns [i, j, score]. */
export function matchRows(left, right, threshold = MATCH_THRESHOLD) {
  const scored = [];
  left.forEach((a, i) =>
    right.forEach((b, j) => {
      const s = requirementSimilarity(a.requirement, b.requirement);
      if (s >= threshold) scored.push([i, j, s]);
    }),
  );
  scored.sort((x, y) => y[2] - x[2] || x[0] - y[0] || x[1] - y[1]);
  const usedL = new Set();
  const usedR = new Set();
  const pairs = [];
  for (const [i, j, s] of scored) {
    if (usedL.has(i) || usedR.has(j)) continue;
    usedL.add(i);
    usedR.add(j);
    pairs.push([i, j, s]);
  }
  return pairs;
}

/**
 * Clusters the rows of N repeats into requirements. `repeats` is an array of
 * row arrays (one per successful repeat). Each cluster is
 * `{ members: (row | null)[] }`, indexed by repeat.
 */
export function clusterRepeats(repeats, threshold = MATCH_THRESHOLD) {
  const clusters = [];
  repeats.forEach((rows, r) => {
    const scored = [];
    rows.forEach((row, i) => {
      clusters.forEach((cluster, c) => {
        if (cluster.members[r]) return;
        let best = 0;
        for (const m of cluster.members) if (m) best = Math.max(best, requirementSimilarity(m.requirement, row.requirement));
        if (best >= threshold) scored.push([i, c, best]);
      });
    });
    scored.sort((x, y) => y[2] - x[2] || x[0] - y[0] || x[1] - y[1]);
    const usedRows = new Set();
    const usedClusters = new Set();
    for (const [i, c] of scored) {
      if (usedRows.has(i) || usedClusters.has(c)) continue;
      usedRows.add(i);
      usedClusters.add(c);
      clusters[c].members[r] = rows[i];
    }
    rows.forEach((row, i) => {
      if (usedRows.has(i)) return;
      const members = new Array(repeats.length).fill(null);
      members[r] = row;
      clusters.push({ members });
    });
  });
  for (const c of clusters) while (c.members.length < repeats.length) c.members.push(null);
  return clusters;
}

// --- Agreement ----------------------------------------------------------------

export const VERDICTS = ["met", "partial", "unmet", "unclear"];

const countsKey = (c) => (c ? VERDICTS.map((v) => c[v] ?? 0).join("/") : "none");

/**
 * Fleiss' kappa over items each rated by the same number of raters. `items` is
 * an array of verdict arrays. Null when it is undefined (one item, one rater,
 * or every rating the same category).
 */
export function fleissKappa(items, categories = VERDICTS) {
  const usable = items.filter((it) => it.length >= 2);
  if (!usable.length) return null;
  const n = usable[0].length;
  if (usable.some((it) => it.length !== n)) throw new Error("fleissKappa needs the same number of ratings per item");
  const N = usable.length;
  const totals = Object.fromEntries(categories.map((c) => [c, 0]));
  let pBarSum = 0;
  for (const it of usable) {
    const counts = Object.fromEntries(categories.map((c) => [c, 0]));
    for (const v of it) counts[v] = (counts[v] ?? 0) + 1;
    let agree = 0;
    for (const c of categories) {
      agree += counts[c] * (counts[c] - 1);
      totals[c] += counts[c];
    }
    pBarSum += agree / (n * (n - 1));
  }
  const pBar = pBarSum / N;
  const pe = categories.reduce((s, c) => s + (totals[c] / (N * n)) ** 2, 0);
  if (pe === 1) return null;
  return (pBar - pe) / (1 - pe);
}

/**
 * How much N repeats of one posting on one setting agree. `turns` are the
 * summarized turns; only those that produced a card are compared.
 */
export function postingAgreement(turns) {
  const carded = turns.filter((t) => t.status === "ok" && t.rows?.length);
  const extractionCounts = turns.filter((t) => t.status === "ok" && t.requirementCount != null).map((t) => t.requirementCount);
  const countTuples = carded.map((t) => countsKey(t.counts));
  const clusters = clusterRepeats(carded.map((t) => t.rows));

  let compared = 0;
  let stable = 0;
  let unstable = 0;
  let metUnmetFlips = 0;
  let partialPresence = 0;
  const fullItems = [];
  for (const c of clusters) {
    const present = c.members.filter(Boolean);
    if (present.length < carded.length) partialPresence += 1;
    if (present.length < 2) continue;
    compared += 1;
    const verdicts = present.map((m) => m.verdict);
    const distinct = new Set(verdicts);
    if (distinct.size === 1) stable += 1;
    else unstable += 1;
    if (distinct.has("met") && distinct.has("unmet")) metUnmetFlips += 1;
    if (present.length === carded.length) fullItems.push(verdicts);
  }

  // Pairwise: of the rows two repeats share, how many got the same verdict.
  let pairShared = 0;
  let pairSame = 0;
  for (let a = 0; a < carded.length; a += 1) {
    for (let b = a + 1; b < carded.length; b += 1) {
      for (const [i, j] of matchRows(carded[a].rows, carded[b].rows)) {
        pairShared += 1;
        if (carded[a].rows[i].verdict === carded[b].rows[j].verdict) pairSame += 1;
      }
    }
  }

  const range = (xs) => (xs.length ? Math.max(...xs) - Math.min(...xs) : null);
  const of = (v) => carded.map((t) => t.counts?.[v] ?? 0);
  return {
    turns: turns.length,
    carded: carded.length,
    extractionCounts,
    extractionAgrees: extractionCounts.length >= 2 ? new Set(extractionCounts).size === 1 : null,
    extractionSpread: range(extractionCounts),
    countTuples,
    countsDiffer: carded.length >= 2 ? new Set(countTuples).size > 1 : null,
    unmetSpread: range(of("unmet")),
    metSpread: range(of("met")),
    clusters: clusters.length,
    compared,
    stable,
    unstable,
    metUnmetFlips,
    partialPresence,
    rowAgreement: compared ? stable / compared : null,
    pairwiseAgreement: pairShared ? pairSame / pairShared : null,
    pairShared,
    pairSame,
    fullItems,
    kappa: fleissKappa(fullItems),
  };
}

// --- Spend ---------------------------------------------------------------------
//
// The hard cap is checked before every request against the running list-price
// total, and it holds even with requests in flight: a request reserves its
// ceiling (the most one turn can cost, below) and settles to its measured
// cost when it finishes. A turn whose cost is unknown (it broke, or sent no
// telemetry) stays charged at its reservation.

export class SpendGuard {
  constructor({ maxUsd, alreadySpentUsd = 0 }) {
    if (!(maxUsd > 0)) throw new Error("maxUsd must be positive");
    this.maxUsd = maxUsd;
    this.settled = alreadySpentUsd;
    this.holds = new Map();
    this.nextId = 1;
  }

  get reserved() {
    let sum = 0;
    for (const v of this.holds.values()) sum += v;
    return sum;
  }

  /** Spent plus everything in flight, at its ceiling. */
  get committed() {
    return this.settled + this.reserved;
  }

  /** A hold for one request, or null when it would take the run past the cap. */
  tryReserve(usd) {
    if (!(usd >= 0)) throw new Error("a reservation needs a non-negative amount");
    if (this.committed + usd > this.maxUsd + 1e-12) return null;
    const id = this.nextId++;
    this.holds.set(id, usd);
    return id;
  }

  /** Settles a hold to what the turn cost. Null or undefined keeps the hold's amount. */
  settle(id, actualUsd) {
    if (!this.holds.has(id)) throw new Error(`unknown hold ${id}`);
    const held = this.holds.get(id);
    this.holds.delete(id);
    const charged = typeof actualUsd === "number" && Number.isFinite(actualUsd) ? actualUsd : held;
    this.settled += charged;
    return charged;
  }

  /** Drops a hold for a request that never reached the server, so cost nothing. */
  release(id) {
    this.holds.delete(id);
  }
}

// --- What a turn costs ------------------------------------------------------------

/**
 * Measured job-posting turns, list price, from docs/followups.md §2 (the
 * smoke test, the reasoning experiment and the re-test, 2026-10-19). Each is
 * the 2,500-character "GTM Systems Manager" posting unless noted. `done` is
 * seconds to the end of the stream.
 */
export const MEASURED_POSTING_TURNS = {
  "openai/gpt-6-luna|low": { usd: [0.0025, 0.0016, 0.0017], done: [16.9, 15.7, 16.2] },
  "openai/gpt-6-luna|provider-default": { usd: [0.0035, 0.0028, 0.0025, 0.00256, 0.00243], done: [36.6, 41.0, 39.5, 32.1, 32.5] },
  "openai/gpt-6-luna|none": { usd: [0.0024, 0.0015], done: [17.9, 18.7] },
  "deepseek/deepseek-v4-flash-0731|provider-default": { usd: [0.00076], done: [43.2] },
  "deepseek/deepseek-v4-flash-0731|none": { usd: [0.00086], done: [18.4] },
  "anthropic/claude-haiku-5.5|provider-default": { usd: [0.00485], done: [22.1] },
  "anthropic/claude-haiku-5.5|none": { usd: [0.00404], done: [15.5] },
  "openai/gpt-5-mini|provider-default": { usd: [0.01976], done: [72.4] },
  "google/gemini-3.5-flash-lite|provider-default": { usd: [0.00896], done: [4.9] },
};

/** The posting the measurements above were taken on, and the short one that anchors the length scaling. */
export const MEASURED_POSTING_CHARS = 2500;
const SHORT_POSTING = { chars: 566, usd: 0.0007 };

/**
 * Cost grows with the posting, because the posting is resent on every step.
 * Fitted on the two GPT-6 Luna `low` points that differ only in length (566
 * and 2,500 characters) and applied to every model as a shape.
 */
export function lengthScale(chars) {
  const long = mean(MEASURED_POSTING_TURNS["openai/gpt-6-luna|low"].usd);
  const perChar = (long - SHORT_POSTING.usd) / (MEASURED_POSTING_CHARS - SHORT_POSTING.chars);
  const base = SHORT_POSTING.usd - perChar * SHORT_POSTING.chars;
  return (base + perChar * chars) / (base + perChar * MEASURED_POSTING_CHARS);
}

/**
 * The share of a turn's list price the Gateway actually billed, where the
 * price is `unconfirmed`. The one measurement: DeepSeek billed 3.3x its
 * headline rate in the 2026-10-20 bake-off. Rounded up.
 */
export const UNCONFIRMED_BILLED_MULTIPLIER = 4;

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Expected and high list-price cost of one posting turn, from the measurements. Null when nothing was measured. */
export function projectTurnUsd({ model, reasoning, chars }) {
  const m = MEASURED_POSTING_TURNS[`${model}|${reasoning}`] ?? MEASURED_POSTING_TURNS[`${model}|provider-default`];
  if (!m) return null;
  const scale = lengthScale(chars);
  const billed = PRICE_CONFIDENCE[model] === "unconfirmed" ? UNCONFIRMED_BILLED_MULTIPLIER : 1;
  return {
    expected: mean(m.usd) * scale,
    high: Math.max(...m.usd) * scale,
    billedHigh: Math.max(...m.usd) * scale * billed,
    doneSec: mean(m.done),
    measured: m.usd.length,
    exact: Boolean(MEASURED_POSTING_TURNS[`${model}|${reasoning}`]),
  };
}

// The route's limits on a posting turn (app/api/chat/route.ts): four steps,
// each capped at the model's posting-turn ceiling from the catalogue
// (maxOutputTokensFor in lib/models.ts). The step count is restated, because
// the route doesn't export it; evals/fit-stability.test.mjs reads the route's
// source to keep it in step.
export const ROUTE_MAX_STEPS = 4;
/** The per-step output ceiling the route applies to this model's posting turns. */
export const routeMaxOutputTokensJd = (model) => maxOutputTokensFor(model, { jobPosting: true });

// First-turn input tokens of an ordinary chip turn, which is the system
// prompt plus a sentence (docs/followups.md, smoke test). Rounded up.
const SYSTEM_PROMPT_TOKENS = {
  "openai/gpt-6-luna": 6600,
  "deepseek/deepseek-v4-flash-0731": 7500,
  "anthropic/claude-haiku-5.5": 10700,
  "openai/gpt-5-mini": 6600,
  "google/gemini-3.5-flash-lite": 7000,
};
// Tool results one step can add to the next one's input: two roleFit results
// at their schema bounds (14 rows, 640 characters each, plus 14 gaps), at 3
// characters a token.
const TOOL_RESULTS_PER_STEP_TOKENS = 12_000;
// The fence and the restated rules wrapPosting adds (lib/job-posting.ts).
const WRAPPER_CHARS = 1000;

/**
 * The most one posting turn can cost at list price, whatever the model does:
 * every step at the output cap, every input token uncached (or written to the
 * cache, whichever is dearer), and each step's input carrying every earlier
 * step's output and tool results. On top of that, the CONSISTENCY_SAMPLES - 1
 * extra assessments the route starts beside the judging step
 * (lib/fit-samples.ts): one call each, with the judging step's input and the
 * same output cap. The spend guard reserves this before a request, so the
 * list-price total can't pass the cap however a turn goes.
 */
export function ceilingTurnUsd({ model, chars }) {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  const cap = routeMaxOutputTokensJd(model);
  const system = SYSTEM_PROMPT_TOKENS[model] ?? 12_000;
  const posting = Math.ceil((chars + JD_PREFIX.length + WRAPPER_CHARS) / 3);
  const perStepGrowth = cap + TOOL_RESULTS_PER_STEP_TOKENS;
  let input = 0;
  for (let step = 0; step < ROUTE_MAX_STEPS; step += 1) input += system + posting + step * perStepGrowth;
  let output = ROUTE_MAX_STEPS * cap;
  // The judging step is step 1, so each extra assessment sees step 1's input.
  const extraSamples = Math.max(0, CONSISTENCY_SAMPLES - 1);
  input += extraSamples * (system + posting + perStepGrowth);
  output += extraSamples * cap;
  const inputRate = Math.max(price.input, price.cacheWrite);
  const listUsd = (input / 1e6) * inputRate + (output / 1e6) * price.output;
  return PRICE_CONFIDENCE[model] === "unconfirmed" ? listUsd * UNCONFIRMED_BILLED_MULTIPLIER : listUsd;
}

/**
 * What the guard charges a finished turn: its list price, multiplied where the
 * price is unconfirmed, or null when the turn reported no usage.
 */
export function chargeFor(model, costUsd) {
  if (costUsd == null) return null;
  return PRICE_CONFIDENCE[model] === "unconfirmed" ? costUsd * UNCONFIRMED_BILLED_MULTIPLIER : costUsd;
}

// --- The gateway's own meter ---------------------------------------------------------

export const CREDITS_URL = "https://ai-gateway.vercel.sh/v1/credits";

/**
 * The account's balance and lifetime spend, from the Gateway. The key is shared
 * with production, so a difference between two reads is an upper bound on
 * what a run spent.
 */
export async function readCredits(apiKey, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(CREDITS_URL, { headers: { authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`credits endpoint returned HTTP ${res.status}`);
  const json = await res.json();
  const num = (v) => (v == null ? null : Number(v));
  return { balance: num(json.balance), totalUsed: num(json.total_used ?? json.totalUsed), at: new Date().toISOString() };
}

// --- Results files -------------------------------------------------------------------

/**
 * Reads a results JSONL. A line cut off by a crash mid-write is skipped, so a
 * resumed run re-sends that turn rather than failing to start.
 */
export function readResults(path) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* a torn last line */
    }
  }
  return out;
}

/** Turns that are finished measurements, and so are skipped on a resume. */
export function finishedKeys(records) {
  return new Set(records.filter((r) => r.status === "ok").map((r) => r.key));
}

/** What earlier invocations of this run already spent, as the guard counted it. */
export function spentSoFar(records) {
  return records.reduce((sum, r) => sum + (typeof r.chargedUsd === "number" ? r.chargedUsd : 0), 0);
}

// --- Aggregation, for the report ----------------------------------------------------------

export function percentile(values, p) {
  const xs = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const idx = (xs.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return xs[lo] + (xs[hi] - xs[lo]) * (idx - lo);
}

export function distribution(values) {
  const xs = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!xs.length) return null;
  return { n: xs.length, p50: percentile(xs, 0.5), p90: percentile(xs, 0.9), max: Math.max(...xs), sum: xs.reduce((a, b) => a + b, 0) };
}

/**
 * Everything the report prints for one setting (model × reasoning), from the
 * latest record per cell. Ratios come with their denominators.
 */
export function aggregateSetting(records) {
  const latest = new Map();
  for (const r of records) {
    const prev = latest.get(r.key);
    if (!prev || prev.status !== "ok" || r.status === "ok") latest.set(r.key, r);
  }
  const turns = [...latest.values()];
  const ok = turns.filter((t) => t.status === "ok");
  const byPosting = new Map();
  for (const t of turns) {
    if (!byPosting.has(t.postingId)) byPosting.set(t.postingId, []);
    byPosting.get(t.postingId).push(t);
  }
  const postings = [...byPosting.entries()].map(([id, ts]) => ({ id, control: ts[0].control, family: ts[0].family, agreement: postingAgreement(ts) }));
  const multi = postings.filter((p) => p.agreement.carded >= 2);

  const sum = (xs, f) => xs.reduce((n, x) => n + (f(x) ?? 0), 0);
  const ratio = (num, den) => ({ num, den, rate: den ? num / den : null });

  const rowsOf = (pred) => ok.filter(pred).flatMap((t) => t.rows ?? []);
  const verdictShare = (rows) => Object.fromEntries(VERDICTS.map((v) => [v, ratio(rows.filter((r) => r.verdict === v).length, rows.length)]));

  const mismatchTurns = ok.filter((t) => t.control === "mismatch" && t.rows?.length);
  const mostlyUnmet = mismatchTurns.filter((t) => {
    const n = t.rows.length;
    const out = t.rows.filter((r) => r.verdict === "unmet" || r.verdict === "unclear").length;
    return n && out / n >= 0.5;
  });

  const fullItems = multi.flatMap((p) => p.agreement.fullItems);
  // Kappa needs every item rated the same number of times; pool by that count.
  const byRaters = new Map();
  for (const it of fullItems) {
    if (!byRaters.has(it.length)) byRaters.set(it.length, []);
    byRaters.get(it.length).push(it);
  }
  const commonRaters = [...byRaters.entries()].sort((a, b) => b[1].length - a[1].length)[0];

  return {
    turns: turns.length,
    statuses: Object.fromEntries([...new Set(turns.map((t) => t.status))].map((s) => [s, turns.filter((t) => t.status === s).length])),
    toolCalls: {
      both: ratio(ok.filter((t) => t.calledExtract && t.calledRoleFit).length, ok.length),
      extract: ratio(ok.filter((t) => t.calledExtract).length, ok.length),
      roleFit: ratio(ok.filter((t) => t.calledRoleFit).length, ok.length),
      duplicateCards: ratio(ok.filter((t) => (t.roleFitCalls ?? 0) > 1).length, ok.length),
    },
    blank: ratio(ok.filter((t) => t.blank).length, ok.length),
    finishReasons: Object.fromEntries([...new Set(ok.map((t) => t.telemetry?.finishReason ?? "none"))].map((f) => [f, ok.filter((t) => (t.telemetry?.finishReason ?? "none") === f).length])),
    stalls: ratio(ok.filter((t) => t.timings?.wouldStall).length, ok.length),
    requirementCount: distribution(ok.map((t) => t.requirementCount)),
    atRowCap: ratio(ok.filter((t) => (t.requirementCount ?? 0) >= 14).length, ok.filter((t) => t.requirementCount != null).length),
    postings: postings.length,
    comparedPostings: multi.length,
    extractionAgrees: ratio(multi.filter((p) => p.agreement.extractionAgrees).length, multi.filter((p) => p.agreement.extractionAgrees != null).length),
    countsDiffer: ratio(multi.filter((p) => p.agreement.countsDiffer).length, multi.length),
    unstableRows: ratio(sum(multi, (p) => p.agreement.unstable), sum(multi, (p) => p.agreement.compared)),
    metUnmetFlips: ratio(sum(multi, (p) => p.agreement.metUnmetFlips), sum(multi, (p) => p.agreement.compared)),
    pairwiseAgreement: ratio(sum(multi, (p) => p.agreement.pairSame), sum(multi, (p) => p.agreement.pairShared)),
    rowsNotInEveryRepeat: ratio(sum(multi, (p) => p.agreement.partialPresence), sum(multi, (p) => p.agreement.clusters)),
    kappa: commonRaters ? { raters: commonRaters[0], items: commonRaters[1].length, value: fleissKappa(commonRaters[1]) } : null,
    unmetSpread: distribution(multi.map((p) => p.agreement.unmetSpread)),
    verdicts: {
      inFamily: verdictShare(rowsOf((t) => t.control === "none")),
      nearMiss: verdictShare(rowsOf((t) => t.control === "near-miss")),
      mismatch: verdictShare(rowsOf((t) => t.control === "mismatch")),
    },
    mismatchMostlyUnmet: ratio(mostlyUnmet.length, mismatchTurns.length),
    citations: {
      positiveRows: ratio(sum(ok, (t) => t.citations?.positiveVerified), sum(ok, (t) => t.citations?.positiveRows)),
      answerClaims: ratio(sum(ok, (t) => t.citations?.answerVerified), sum(ok, (t) => t.citations?.answerClaims)),
      uncitedDowngrades: sum(ok, (t) => t.citations?.uncitedDowngrades),
      unknownIds: [...new Set(ok.flatMap((t) => t.citations?.unknownIds ?? []))],
    },
    costUsd: distribution(ok.map((t) => t.costUsd)),
    chargedUsd: sum(turns, (t) => t.chargedUsd),
    timings: {
      extractedMs: distribution(ok.map((t) => t.timings?.extractedMs)),
      cardMs: distribution(ok.map((t) => t.timings?.cardMs)),
      doneMs: distribution(ok.map((t) => t.timings?.doneMs)),
      maxGapMs: distribution(ok.map((t) => t.timings?.maxGapMs)),
    },
    tokens: {
      input: distribution(ok.map((t) => t.telemetry?.usage?.inputTokens)),
      output: distribution(ok.map((t) => t.telemetry?.usage?.outputTokens)),
      reasoning: distribution(ok.map((t) => t.telemetry?.usage?.reasoningTokens)),
    },
  };
}
