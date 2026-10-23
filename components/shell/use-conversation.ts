"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { track } from "@/lib/analytics";
import { JD_PREFIX, looksLikeJobPosting } from "@/lib/job-posting";
import { decodeSnapshot, payloadFromHash } from "@/lib/permalink";
import {
  isPlainPanelKind,
  PANEL_BY_TOOL,
  PANELS,
  type PanelView,
  type RoleFit,
} from "./panels";
import {
  isRateLimitClass,
  isSilentClass,
  toTurnErrorClass,
  type ChatUIMessage,
  type TurnErrorClass,
  type TurnTelemetry,
} from "@/lib/chat-telemetry";
import { guardedFetch, INTERNAL_TOOLS, TurnFailure, type Budget } from "@/lib/chat-transport";
import { activityOf, phaseOf } from "@/lib/turn-phase";
import { MAX_USER_MESSAGES } from "@/lib/models";
import { publishPhaseActivity } from "./phase-activity";
import { isChatEntry, markEntry } from "./conversation-history";

/** Re-exported from lib/chat-transport, where the fetch that reads it lives. */
export type { Budget };

// Every message is the app's typed variant, which carries the per-turn
// telemetry data part.
type UIMessage = ChatUIMessage;

/** The same type, exported for the components that render a message. */
export type ChatMessage = ChatUIMessage;


// Bump the version when a stored message can no longer be rendered by the code
// that reads it back. Retiring the old key drops exactly those conversations
// without guessing at message shapes, and the retired keys are removed on
// restore. A permalink carries the same tool results without touching storage,
// so the role-fit table in panel-body.tsx also refuses a payload it doesn't
// recognise rather than throwing.
const STORAGE_KEY = "conversation.v2";
const RETIRED_STORAGE_KEYS = ["conversation.v1"];

// Reading the clock is impure, and calling it inside a component body trips
// react-hooks/purity even from an event handler.
const nowMs = () => performance.now();

// Whether the shell has already been on screen in this document. A reload or a
// new visit starts false; a client-side return from /resume finds it true,
// because the module outlives the route change. Set from the restore's
// microtask rather than the effect body, so React's development double-run of
// effects (whose first run is cancelled) can't set it early.
let shownInThisDocument = false;

/** A conversation that isn't on screen but can be brought back. */
export type SavedConversation = {
  messages: UIMessage[];
  /** Whether it came from a link, which is never written to storage. */
  replayed: boolean;
};

/**
 * Ends on a question without a whole answer: nothing after it, nothing that
 * renders, or an answer cut off mid-stream (left with Home, stopped, or the tab
 * closed). The last is read off the turn's record, which carries usage or an
 * error once the route's closing write lands and neither before it. A replay
 * carries no record, so it is never read as cut off.
 */
function endsUnanswered(messages: UIMessage[]): boolean {
  const last = messages[messages.length - 1];
  if (!last) return false;
  if (last.role === "user") return true;
  if (!textOf(last) && toolOutputs(last).length === 0) return true;
  const turn = last.parts.find((p) => p.type === "data-turn");
  return turn != null && turn.data.usage == null && turn.data.error == null;
}

function userTurns(messages: UIMessage[]): number {
  return messages.filter((m) => m.role === "user").length;
}

// Re-exported from ./panels for the components that get panel state from this
// hook.
export type { PanelView, RoleFit };

export type ToolOut = { type: string; state?: string; output?: unknown };

export function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

// Tool calls with no surface of their own. `extractRequirements` is the first
// half of a job-posting turn: its output feeds the assessment that follows and
// is rendered inside it, so a chip of its own would open the same table twice.
// The set is defined in lib/chat-transport.ts, which also uses it to tell an
// empty turn from one that showed a card.
const INTERNAL_PARTS = new Set([...INTERNAL_TOOLS].map((name) => `tool-${name}`));

export function toolOutputs(message: UIMessage): ToolOut[] {
  return message.parts
    .map((p) => p as unknown as ToolOut)
    .filter(
      (p) =>
        typeof p.type === "string" &&
        p.type.startsWith("tool-") &&
        !INTERNAL_PARTS.has(p.type) &&
        p.state === "output-available" &&
        p.output != null,
    );
}

// What the turn is doing right now is read in lib/turn-phase.ts, where the
// evals can import it.
export { OPENING_PHASE, phaseOf } from "@/lib/turn-phase";

/**
 * The panel a turn's tool outputs open; the first output that maps to one wins.
 * Which tool opens which kind is the registry's `fromTool`. This only builds
 * the payload for the two kinds that carry one.
 */
export function panelForTool(outs: ToolOut[]): PanelView | null {
  for (const out of outs) {
    const kind = PANEL_BY_TOOL[out.type];
    if (!kind) continue;
    if (kind === "project") {
      const slug = (out.output as { slug?: string })?.slug ?? "";
      // An unrecognised slug falls back to the list rather than a blank panel.
      if (slug === "adarle20" || slug === "nokia" || slug === "dell-ml") {
        return { kind: "project", slug };
      }
      return { kind: "projects" };
    }
    if (kind === "roleFit") return { kind: "roleFit", data: out.output as RoleFit };
    if (isPlainPanelKind(kind)) return { kind };
  }
  return null;
}

/**
 * One turn's telemetry as the client holds it. `clientTtftMs` sits beside the
 * server's `timing.ttftMs` rather than replacing it: the server measures model
 * latency, the client measures what the reader waited through, and the gap
 * between them is the network.
 */
export type TurnRecord = TurnTelemetry & {
  clientTtftMs: number | null;
  messageId: string | null;
};

export function useConversation(model: string) {
  const [errorKind, setErrorKind] = useState<"none" | "error" | "rate_limited">("none");
  const [errorClass, setErrorClass] = useState<TurnErrorClass | null>(null);
  const [panel, setPanel] = useState<PanelView>({ kind: "none" });
  const [ttft, setTtft] = useState<number | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  // One entry per turn, oldest first. In-memory only: the telemetry data part
  // persists on the message, but nothing reads the log across a reload.
  const [turnLog, setTurnLog] = useState<TurnRecord[]>([]);

  // Built once: the fetch wrapper closes over setBudget, and both are stable.
  //
  // `?simulate=<class>` on the page is forwarded to the chat endpoint, so the
  // whole shell enters that failure state, not just one fetch in the instrument
  // deck. It is the only way to see the rate-limited view without spending the
  // budget. It can't produce an answer or cost a token: the route accepts only
  // a value from its closed list of simulatable failures.
  const [transport] = useState(() => {
    const simulate =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("simulate");
    return new DefaultChatTransport({
      api: simulate ? `/api/chat?simulate=${encodeURIComponent(simulate)}` : "/api/chat",
      fetch: guardedFetch({ onBudget: (b) => setBudget(b) }),
    });
  });

  // The selected model goes in each request body. Kept in a ref so changing it
  // never rebuilds the transport mid-conversation, and synced in an effect
  // because writing a ref during render is a tearing hazard under concurrent
  // rendering.
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  // Gates both halves of persistence. Reading localStorage during render would
  // make the first client render differ from the server's, a hydration
  // mismatch, so the conversation starts empty and is restored after mount.
  const [hydrated, setHydrated] = useState(false);

  // True when this conversation came from a URL fragment rather than from this
  // browser. Drives the banner and switches persistence off.
  const [replayed, setReplayed] = useState(false);

  // The conversation the front door offers to continue: the one in storage
  // after a reload, or the one just left by Home. Not on screen, so a visitor
  // who reloads or heads home lands on the front door, and one tap brings it
  // back.
  const [saved, setSaved] = useState<SavedConversation | null>(null);

  // The client's own stopwatch, kept so the record can carry both latencies.
  // `sentAt` is when the turn was sent; the closing record of a stored answer
  // reads it too, so it is declared before the chat hook.
  const clientTtft = useRef<number | null>(null);
  const sentAt = useRef<number | null>(null);

  const {
    messages,
    sendMessage,
    status,
    setMessages,
    // `regenerate` resends the last turn, dropping a partial assistant message
    // first, so a turn that died mid-answer is retried rather than continued.
    // `stop` aborts one in flight; the SDK treats that as a non-event (status
    // returns to "ready" and onError never fires), so stopping isn't a failure.
    regenerate,
    stop,
    clearError,
  } = useChat<UIMessage>({
    transport,
    // The route writes one `data-turn` part per turn under a fixed id: an
    // opening write with the model and budget, then a closing write with the
    // measurements. The SDK merges them into one part but calls onData for
    // both, so the opening write (no usage, no error) appends a record and the
    // closing one replaces it.
    onData: (part) => {
      if (part.type !== "data-turn") return;
      const data = part.data;
      const opening = data.usage == null && data.error == null;
      // A stored answer arrives whole, in one read, and React can batch from
      // "submitted" straight to "ready" without rendering "streaming", which is
      // where the time-to-first-token effect takes its reading. Taken here
      // instead: for a replay, the closing record lands with the answer.
      if (!opening && data.stored && sentAt.current != null) {
        const elapsed = Math.round(nowMs() - sentAt.current);
        sentAt.current = null;
        clientTtft.current = elapsed;
        queueMicrotask(() => setTtft(elapsed));
      }
      const record: TurnRecord = {
        ...data,
        clientTtftMs: clientTtft.current,
        messageId: null,
      };
      setTurnLog((prev) =>
        opening || prev.length === 0 ? [...prev, record] : [...prev.slice(0, -1), record],
      );
      if (opening) return;

      if (data.error) {
        track("chat_turn_failed", {
          error_class: data.error.class,
          model: data.model,
          jd: data.jobPosting,
        });
        return;
      }
      const cached = data.usage?.cachedInputTokens ?? 0;
      const input = data.usage?.inputTokens ?? 0;
      track("chat_turn_complete", {
        model: data.model,
        jd: data.jobPosting,
        ttft_ms: data.timing?.ttftMs ?? null,
        client_ttft_ms: clientTtft.current,
        duration_ms: data.timing?.durationMs ?? null,
        tokens_per_second: data.timing?.tokensPerSecond ?? null,
        input_tokens: data.usage?.inputTokens ?? null,
        cached_input_tokens: data.usage?.cachedInputTokens ?? null,
        output_tokens: data.usage?.outputTokens ?? null,
        reasoning_tokens: data.usage?.reasoningTokens ?? null,
        cache_hit: cached > 0,
        cache_hit_ratio: input > 0 ? Math.round((cached / input) * 100) / 100 : null,
        steps: data.steps,
        tools_called: data.toolsCalled,
        finish_reason: data.finishReason,
        // A replay of a stored answer: its timing is a store read, so it is
        // split out before anyone averages the chat's latency.
        stored: data.stored != null,
      });
    },
    // Stamps the record with the message it belongs to, so an instrument can
    // go from an answer on screen to the numbers behind it.
    onFinish: ({ message }) => {
      setTurnLog((prev) =>
        prev.length === 0
          ? prev
          : [...prev.slice(0, -1), { ...prev[prev.length - 1]!, messageId: message.id }],
      );
    },
    onError: (error) => {
      // The transport already knows the class it threw. Anything the SDK
      // raised itself still has to be read out of the message.
      const cls = error instanceof TurnFailure ? error.cls : toTurnErrorClass(error.message);
      // An aborted turn renders nothing, including when the abort arrives as a
      // class over the stream rather than through the SDK's own abort path
      // (which never reaches onError). It is still tracked.
      if (isSilentClass(cls)) {
        track("chat_error", { error_class: cls, model: modelRef.current });
        return;
      }
      // The route marks an empty turn's record with the class itself. If the
      // record arrives unmarked anyway, the transport's reading wins: it knows
      // nothing reached the page, and an unmarked record is priced and logged
      // as an answer.
      if (cls === "empty_answer") {
        setTurnLog((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.error) return prev;
          return [...prev.slice(0, -1), { ...last, error: { class: cls, detail: "no text" } }];
        });
      }
      const kind = isRateLimitClass(cls) ? "rate_limited" : "error";
      setErrorKind(kind);
      setErrorClass(cls);
      track(kind === "rate_limited" ? "chat_rate_limited" : "chat_error", {
        error_class: cls,
        model: modelRef.current,
      });
    },
  });

  const isBusy = status === "submitted" || status === "streaming";

  // The phase line's readout (see ./phase-activity for why it travels this
  // way). Published after commit rather than during render, and cleared when
  // the hook goes away, so a remounted shell never inherits a stale "6/14".
  useEffect(() => {
    publishPhaseActivity(activityOf(status, messages));
  }, [status, messages]);
  useEffect(() => () => publishPhaseActivity(null), []);

  const sentCount = useRef(0);

  // Put a conversation back on screen. One that ends on an unanswered question
  // says so and offers to ask again, because the failure that left it there
  // isn't saved. Past the cap there is nothing to retry; the shell's
  // conversation-full notice covers it.
  const show = useCallback(
    (next: UIMessage[]) => {
      setMessages(next);
      if (endsUnanswered(next) && userTurns(next) <= MAX_USER_MESSAGES) {
        setErrorKind("error");
        setErrorClass("interrupted");
      }
    },
    [setMessages],
  );

  // Restore once, after mount. A permalink in the fragment wins over local
  // storage: someone who opened a link came to read that conversation.
  //
  // A stored conversation is not put back on screen. A reload, a new visit and
  // a click on the name all land on the front door, which offers it as
  // "continue". The one exception is coming back with Back from another page of
  // the site, where the entry still says "chat" and the visitor expects to be
  // where they left.
  useEffect(() => {
    let cancelled = false;
    const returning = shownInThisDocument;

    function restoreLocal() {
      let stored: UIMessage[] = [];
      try {
        for (const key of RETIRED_STORAGE_KEYS) window.localStorage.removeItem(key);
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) stored = parsed as UIMessage[];
      } catch {
        /* unreadable / private mode — start fresh */
      }
      queueMicrotask(() => {
        if (cancelled) return;
        shownInThisDocument = true;
        if (returning && isChatEntry() && stored.length) {
          show(stored);
        } else {
          if (stored.length) setSaved({ messages: stored, replayed: false });
          // A reload keeps the entry's state, so one that said "chat" is
          // relabelled to match the front door it now shows.
          if (isChatEntry()) markEntry("home");
        }
        setHydrated(true);
      });
    }

    const payload = payloadFromHash(window.location.hash);
    if (!payload) {
      restoreLocal();
      return () => {
        cancelled = true;
      };
    }

    void decodeSnapshot(payload).then((restored) => {
      if (cancelled) return;
      // A fragment that doesn't decode is most likely a link an email client
      // truncated. Fall back to the reader's own conversation, not an error.
      if (!restored?.length) {
        restoreLocal();
        return;
      }
      shownInThisDocument = true;
      setReplayed(true);
      setMessages(
        restored.map((m, i) => ({
          id: `replay-${i}`,
          role: m.role as "user" | "assistant",
          parts: m.parts,
        })) as unknown as UIMessage[],
      );
      // A link opens as a conversation, so its entry says so. Home then pushes
      // a front door on top of it, and Back returns to the replay.
      markEntry("chat");
      setHydrated(true);
      track("chat_permalink_opened", { messages: restored.length });
    });

    return () => {
      cancelled = true;
    };
  }, [setMessages, show]);

  // Persist only once restore has run, so the empty first render can't wipe
  // the stored conversation before it's read back.
  //
  // A replayed conversation is never persisted: the reader may have their own
  // conversation in this browser, and a link they were sent must not overwrite
  // it. The replay lives in memory until the tab closes or they start afresh.
  //
  // An empty screen is the front door, not a deletion: leaving a conversation
  // keeps it to continue. Only `clearSaved` and a new conversation remove it.
  useEffect(() => {
    if (!hydrated || replayed) return;
    try {
      if (messages.length) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      }
    } catch {
      /* private mode / quota — persistence is a nicety, never a hard dependency */
    }
  }, [messages, hydrated, replayed]);

  // Time to first token: the gap between send and the first streamed character.
  useEffect(() => {
    if (status === "streaming" && sentAt.current != null) {
      const elapsed = Math.round(nowMs() - sentAt.current);
      sentAt.current = null;
      clientTtft.current = elapsed;
      queueMicrotask(() => setTtft(elapsed));
    }
  }, [status]);

  // Route tool output into the context panel rather than rendering it inline:
  // the answer is prose and the evidence opens beside it.
  //
  // On desktop the panel shows whenever a view is set. On mobile it is a sheet
  // that stays closed until the reader taps a citation chip, because a sheet
  // covering half the screen mid-answer is hostile. That asymmetry is
  // intentional; don't open the sheet here.
  //
  // A panel marked `stealable: false` in the registry (the instrument deck) is
  // never replaced while open. The citation chip still opens the evidence.
  const lastToolKey = useRef<string>("");
  const panelRef = useRef(panel);
  useEffect(() => {
    panelRef.current = panel;
  }, [panel]);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const outs = toolOutputs(last);
    if (!outs.length) return;
    const key = `${last.id}:${outs.length}`;
    if (key === lastToolKey.current) return;
    lastToolKey.current = key;
    if (!PANELS[panelRef.current.kind].stealable) return;

    const next = panelForTool(outs);
    // Deferred so the effect body doesn't setState synchronously.
    if (next) queueMicrotask(() => setPanel(next));
  }, [messages]);

  // The route answers a question past the cap with the same 429 as a spent
  // hourly budget, and the shell would show the budget's "wait an hour" state
  // for something a new conversation fixes at once. So the cap is enforced
  // here, before the request, and the shell says which limit it is.
  const full = userTurns(messages) >= MAX_USER_MESSAGES;

  function submit(text: string) {
    const q = text.trim();
    if (!q || isBusy || full) return;
    // A question from the front door starts a new conversation, which takes
    // the saved one's place in storage. The front door says so beside it.
    if (messages.length === 0) setSaved(null);
    setErrorKind("none");
    setErrorClass(null);
    sentAt.current = nowMs();
    clientTtft.current = null;
    setTtft(null);
    // A pasted posting is someone else's document, often an internal one, so
    // it never goes to analytics: a posting turn reports its length and the
    // flag. An ordinary question (500 characters at most) still goes, because
    // what visitors ask is the point of collecting it.
    const posting = q.startsWith(JD_PREFIX) || looksLikeJobPosting(q);
    track(
      "chat_message_sent",
      posting
        ? { message_index: sentCount.current, jd: true, message_length: q.length }
        : { message_index: sentCount.current, message: q },
    );
    sentCount.current += 1;
    void sendMessage({ text: q }, { body: { model: modelRef.current } });
  }

  /**
   * Send the last turn again after it failed. Restarts the stopwatch as
   * `submit` does, so the ttft measures the wait the reader is sitting through
   * now, not the one that failed.
   *
   * `withModel` asks the same question of a different model. It is passed in
   * rather than read from the ref because the caller changes the selection in
   * the same tap, and the ref only catches up after the next render.
   */
  function retry(withModel?: string) {
    if (isBusy) return;
    const model = withModel ?? modelRef.current;
    setErrorKind("none");
    setErrorClass(null);
    clearError();
    sentAt.current = nowMs();
    clientTtft.current = null;
    setTtft(null);
    track("chat_retry", { model, switched: withModel != null });
    void regenerate({ body: { model } });
  }

  /**
   * Back to the front door. The conversation isn't deleted: it becomes the
   * saved one the front door offers to continue. A turn in flight is stopped
   * first, and continuing it later offers to ask that question again.
   *
   * Writes no history; the caller does, or the browser already has (Back).
   * The address loses the panel's path and a permalink's fragment there, so a
   * reload after leaving a replay opens the site rather than the link again.
   */
  const leave = useCallback(() => {
    if (isBusy) stop();
    if (messages.length) setSaved({ messages, replayed });
    setMessages([]);
    setPanel({ kind: "none" });
    setReplayed(false);
    setErrorKind("none");
    setErrorClass(null);
    setTtft(null);
    setTurnLog([]);
    clientTtft.current = null;
    lastToolKey.current = "";
  }, [isBusy, stop, messages, replayed, setMessages]);

  /** The saved conversation, back on screen. Writes no history, as `leave`. */
  const resume = useCallback(() => {
    if (!saved) return;
    setReplayed(saved.replayed);
    show(saved.messages);
    setSaved(null);
  }, [saved, show]);

  /**
   * Forget the saved conversation. A replay was never stored, and the visitor's
   * own conversation in storage is not the one they're clearing.
   */
  function clearSaved() {
    if (!saved) return;
    if (!saved.replayed) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* nothing stored to remove */
      }
    }
    setSaved(null);
  }

  return {
    messages,
    submit,
    /** Resend the turn that just failed. Wired to TurnError's buttons. */
    retry,
    /** Abort the turn in flight. Not treated as a failure. */
    stop,
    leave,
    resume,
    clearSaved,
    /** What the front door offers to continue, if anything. */
    saved,
    /** At the per-conversation question cap; `submit` refuses past it. */
    full,
    isBusy,
    /** One line naming the step in flight, or null once prose is on screen. */
    phase: phaseOf(status, messages),
    errorKind,
    // True while the conversation on screen was rebuilt from a permalink.
    replayed,
    // The class behind `errorKind`. TurnError renders its copy.
    errorClass,
    ttft,
    panel,
    setPanel,
    budget,
    turnLog,
    telemetry: turnLog.length ? turnLog[turnLog.length - 1]! : null,
    turns: messages.filter((m) => m.role === "user").length,
  };
}
