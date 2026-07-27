"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { track } from "@/lib/analytics";


const STORAGE_KEY = "conversation.v1";

// Reading the clock is impure, and calling it inside a component body trips
// react-hooks/purity even from an event handler.
const nowMs = () => performance.now();

export type RoleFit = {
  role: string;
  matches: { area: string; evidence: string }[];
  caveats?: string;
};

export type PanelView =
  | { kind: "none" }
  | { kind: "resume"; focus?: string }
  | { kind: "projects" }
  | { kind: "project"; slug: "adarle20" | "nokia" | "dell-ml" }
  | { kind: "colophon" }
  | { kind: "contact" }
  | { kind: "why" }
  | { kind: "roleFit"; data: RoleFit };

export type ToolOut = { type: string; state?: string; output?: unknown };

export function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function toolOutputs(message: UIMessage): ToolOut[] {
  return message.parts
    .map((p) => p as unknown as ToolOut)
    .filter(
      (p) =>
        typeof p.type === "string" &&
        p.type.startsWith("tool-") &&
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

// Distinguishes a 429 (rate-limit copy) from any other failure. useChat's
// onError receives only an Error, not the HTTP status, so the status is read
// here and encoded in the message.
const chatFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (!res.ok) {
    let code = "error";
    try {
      const body = (await res.clone().json()) as { error?: string };
      if (res.status === 429 || body?.error === "rate_limited") code = "rate_limited";
    } catch {
      if (res.status === 429) code = "rate_limited";
    }
    throw new Error(code);
  }
  return res;
};

export function useConversation() {
  const [errorKind, setErrorKind] = useState<"none" | "error" | "rate_limited">("none");
  const [panel, setPanel] = useState<PanelView>({ kind: "none" });
  const [ttft, setTtft] = useState<number | null>(null);

  // `hydrated` gates BOTH halves of persistence. Reading localStorage during
  // render makes the server emit an empty conversation while the client emits
  // the restored one — a hydration mismatch. The first client render must match
  // the server exactly, so: start empty, restore after mount.
  const [hydrated, setHydrated] = useState(false);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", fetch: chatFetch }),
    onError: (error) => {
      const kind = error.message === "rate_limited" ? "rate_limited" : "error";
      setErrorKind(kind);
      track(kind === "rate_limited" ? "chat_rate_limited" : "chat_error");
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
  const lastToolKey = useRef<string>("");
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const outs = toolOutputs(last);
    if (!outs.length) return;
    const key = `${last.id}:${outs.length}`;
    if (key === lastToolKey.current) return;
    lastToolKey.current = key;

    const next = panelForTool(outs);
    // Deferred so the effect body doesn't setState synchronously.
    if (next) queueMicrotask(() => setPanel(next));
  }, [messages]);

  function submit(text: string) {
    const q = text.trim();
    if (!q || isBusy) return;
    setErrorKind("none");
    sentAt.current = nowMs();
    setTtft(null);
    track("chat_message_sent", { message_index: sentCount.current, message: q });
    sentCount.current += 1;
    void sendMessage({ text: q });
  }

  function reset() {
    setMessages([]);
    setPanel({ kind: "none" });
    setErrorKind("none");
    setTtft(null);
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
    ttft,
    panel,
    setPanel,
    turns: messages.filter((m) => m.role === "user").length,
  };
}
