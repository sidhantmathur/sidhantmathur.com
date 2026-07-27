"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { track } from "@/lib/analytics";
import type { RoleFitResult } from "@/lib/role-fit";
import {
  isRateLimitClass,
  toTurnErrorClass,
  type ChatUIMessage,
  type TurnErrorClass,
  type TurnTelemetry,
} from "@/lib/chat-telemetry";

// Alias so the rest of this file (and its callers) read as before while every
// message is the app's typed variant, carrying the F1 telemetry data part.
type UIMessage = ChatUIMessage;


const STORAGE_KEY = "conversation.v1";

// Reading the clock is impure, and calling it inside a component body trips
// react-hooks/purity even from an event handler.
const nowMs = () => performance.now();

// The reconciled assessment, exactly as lib/role-fit.ts returns it — the client
// re-derives none of it. Every verdict on screen was decided server-side, and
// re-computing one here would be a second opinion nobody asked for.
export type RoleFit = RoleFitResult;

export type PanelView =
  | { kind: "none" }
  | { kind: "resume"; focus?: string }
  | { kind: "projects" }
  | { kind: "project"; slug: "adarle20" | "nokia" | "dell-ml" }
  | { kind: "colophon" }
  | { kind: "contact" }
  | { kind: "why" }
  | { kind: "jd" }
  | { kind: "instruments" }
  // One chunk of the corpus, opened from a citation (Sprint 3, F2/#4). The
  // whole file renders; `id` is what gets highlighted and scrolled to.
  | { kind: "source"; id: string }
  | { kind: "roleFit"; data: RoleFit };

export type ToolOut = { type: string; state?: string; output?: unknown };

export function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

// Tool calls with no surface of their own. `extractRequirements` is the first
// half of a job-description turn (Sprint 4): its output is the input to the
// assessment that follows and is rendered inside it, so surfacing it separately
// would put a chip on the page that opens the same table twice.
const INTERNAL_TOOLS = new Set(["tool-extractRequirements"]);

export function toolOutputs(message: UIMessage): ToolOut[] {
  return message.parts
    .map((p) => p as unknown as ToolOut)
    .filter(
      (p) =>
        typeof p.type === "string" &&
        p.type.startsWith("tool-") &&
        !INTERNAL_TOOLS.has(p.type) &&
        p.state === "output-available" &&
        p.output != null,
    );
}

/** First tool output in a turn wins the panel. */
export function panelForTool(outs: ToolOut[]): PanelView | null {
  for (const out of outs) {
    if (out.type === "tool-showProject") {
      const slug = (out.output as { slug?: string })?.slug ?? "";
      if (slug === "adarle20" || slug === "nokia" || slug === "dell-ml") {
        return { kind: "project", slug };
      }
      return { kind: "projects" };
    }
    if (out.type === "tool-showResume") return { kind: "resume" };
    if (out.type === "tool-contactCard") return { kind: "contact" };
    if (out.type === "tool-roleFit")
      return { kind: "roleFit", data: out.output as RoleFit };
  }
  return null;
}

export type Budget = { tier: string; remaining: number; limit: number };

/**
 * One turn's telemetry as the client holds it (F1).
 *
 * `clientTtftMs` is deliberately kept alongside the server's `timing.ttftMs`
 * rather than replacing it: the server measures model latency, the client
 * measures what the reader waited through, and the gap between them is the
 * network. Sprint 2's instruments want both.
 */
export type TurnRecord = TurnTelemetry & {
  clientTtftMs: number | null;
  messageId: string | null;
};

// Turns any failure into one of the telemetry error classes. useChat's onError
// receives only an Error, not the HTTP status, so the class is read here — from
// the JSON body the route sends on an early exit, or from the status — and
// encoded as the message. Mid-stream failures already arrive as a class string,
// because the route's stream `onError` returns one.
//
// Also lifts the per-tier budget out of the response headers, which is where it
// lands before a single token has streamed.
function makeChatFetch(onBudget: (b: Budget) => void): typeof fetch {
  return async (input, init) => {
    const res = await fetch(input, init);
    if (!res.ok) {
      let code: TurnErrorClass = res.status === 429 ? "rate_limited" : "upstream_unavailable";
      try {
        const body = (await res.clone().json()) as { error?: string };
        if (body?.error) code = toTurnErrorClass(body.error);
      } catch {
        /* non-JSON body — the status-derived class above stands */
      }
      throw new Error(code);
    }
    const tier = res.headers.get("x-tier");
    const remaining = Number(res.headers.get("x-tier-remaining"));
    const limit = Number(res.headers.get("x-tier-limit"));
    if (tier && Number.isFinite(remaining) && Number.isFinite(limit)) {
      onBudget({ tier, remaining, limit });
    }
    return res;
  };
}

export function useConversation(model: string) {
  const [errorKind, setErrorKind] = useState<"none" | "error" | "rate_limited">("none");
  const [errorClass, setErrorClass] = useState<TurnErrorClass | null>(null);
  const [panel, setPanel] = useState<PanelView>({ kind: "none" });
  const [ttft, setTtft] = useState<number | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  // One entry per turn, oldest first. In-memory only: the telemetry data part
  // does persist on the message, but the derived log is cheap to rebuild and
  // nothing yet reads it across a reload.
  const [turnLog, setTurnLog] = useState<TurnRecord[]>([]);

  // The transport closes over the fetch wrapper, and the wrapper closes over
  // setBudget. Both are stable, so the transport is built once.
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: makeChatFetch((b) => setBudget(b)),
      }),
  );

  // The selected model has to reach the request body. Kept in a ref so changing
  // it never rebuilds the transport mid-conversation. Synced in an effect
  // rather than during render — writing a ref while rendering is a tearing
  // hazard under concurrent rendering.
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  // `hydrated` gates BOTH halves of persistence. Reading localStorage during
  // render makes the server emit an empty conversation while the client emits
  // the restored one — a hydration mismatch. The first client render must match
  // the server exactly, so: start empty, restore after mount.
  const [hydrated, setHydrated] = useState(false);

  // The client's own stopwatch, kept so the record can carry both latencies.
  const clientTtft = useRef<number | null>(null);

  const { messages, sendMessage, status, setMessages } = useChat<UIMessage>({
    transport,
    // F1's channel. The route writes ONE `data-turn` part per turn under a
    // fixed id: an opening write with the model, tier and budget, then a
    // closing write with the measurements. The SDK reconciles them into a
    // single part, but fires this for both — so the opening write (no usage,
    // no error) appends a record and the closing one replaces it.
    onData: (part) => {
      if (part.type !== "data-turn") return;
      const data = part.data;
      const opening = data.usage == null && data.error == null;
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
          tier: data.tier,
          jd: data.jobPosting,
        });
        return;
      }
      const cached = data.usage?.cachedInputTokens ?? 0;
      const input = data.usage?.inputTokens ?? 0;
      track("chat_turn_complete", {
        model: data.model,
        tier: data.tier,
        jd: data.jobPosting,
        ttft_ms: data.timing?.ttftMs ?? null,
        client_ttft_ms: clientTtft.current,
        duration_ms: data.timing?.durationMs ?? null,
        tokens_per_second: data.timing?.tokensPerSecond ?? null,
        input_tokens: data.usage?.inputTokens ?? null,
        cached_input_tokens: data.usage?.cachedInputTokens ?? null,
        output_tokens: data.usage?.outputTokens ?? null,
        cache_hit: cached > 0,
        cache_hit_ratio: input > 0 ? Math.round((cached / input) * 100) / 100 : null,
        steps: data.steps,
        tools_called: data.toolsCalled,
        finish_reason: data.finishReason,
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
      const cls = toTurnErrorClass(error.message);
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
  const sentAt = useRef<number | null>(null);
  const sentCount = useRef(0);

  // Restore once, after mount. One conversation, not a history sidebar.
  useEffect(() => {
    let saved: UIMessage[] = [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) saved = parsed as UIMessage[];
    } catch {
      /* unreadable / private mode — start fresh */
    }
    queueMicrotask(() => {
      if (saved.length) setMessages(saved);
      setHydrated(true);
    });
  }, [setMessages]);

  // Persist only once restore has run, so the empty first render can't wipe
  // the stored conversation before it's read back.
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (messages.length) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* private mode / quota — persistence is a nicety, never a hard dependency */
    }
  }, [messages, hydrated]);

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
  // the assistant answers in prose and the evidence opens beside it.
  //
  // Setting panel state is enough for desktop, where the panel is visible
  // whenever a view is set. On mobile the panel is a sheet that stays CLOSED
  // until the reader taps a citation chip — a sheet covering half the screen
  // mid-answer is hostile. That asymmetry is intentional; don't "fix" it by
  // opening the sheet here.
  //
  // The one exception is the instrument deck: it is only ever opened
  // deliberately, and having a tool call yank it away mid-reading would make
  // the instruments feel like they belong to the model rather than the reader.
  // The citation chip under the answer is still there to open the evidence.
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
    if (panelRef.current.kind === "instruments") return;

    const next = panelForTool(outs);
    // Deferred so the effect body doesn't setState synchronously.
    if (next) queueMicrotask(() => setPanel(next));
  }, [messages]);

  function submit(text: string) {
    const q = text.trim();
    if (!q || isBusy) return;
    setErrorKind("none");
    setErrorClass(null);
    sentAt.current = nowMs();
    clientTtft.current = null;
    setTtft(null);
    track("chat_message_sent", { message_index: sentCount.current, message: q });
    sentCount.current += 1;
    void sendMessage({ text: q }, { body: { model: modelRef.current } });
  }

  function reset() {
    setMessages([]);
    setPanel({ kind: "none" });
    setErrorKind("none");
    setErrorClass(null);
    setTtft(null);
    setTurnLog([]);
    clientTtft.current = null;
    lastToolKey.current = "";
  }

  const awaitingReply =
    status === "submitted" ||
    (status === "streaming" && messages[messages.length - 1]?.role !== "assistant");

  return {
    messages,
    submit,
    reset,
    isBusy,
    awaitingReply,
    errorKind,
    // The class behind `errorKind`. Nothing renders it yet — #6 (Sprint 2) is
    // what it's here for; F1's job is that the number exists to be read.
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
