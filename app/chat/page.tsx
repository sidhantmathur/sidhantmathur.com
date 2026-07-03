"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { track } from "@/lib/analytics";

// Copy strings — verbatim from docs/site-copy.md (lines 84–90, 229–234).
const EMPTY_STATE =
  "Ask me about my work at Nokia, A Darle 20, or anything on my resume.";
const ERROR_STATE =
  "Something went wrong on my end. Give it another try in a moment.";
const RATE_LIMIT_STATE =
  "You've hit the message limit for now — the resume has everything in the meantime.";
const DISCLAIMER =
  "AI-generated answers about my professional background. It can make mistakes — the resume is the authoritative version.";
const SUGGESTED = [
  "What did Sidhant build at Nokia?",
  "How does A Darle 20 work?",
  "Is he a fit for a solutions engineering role?",
];

// A custom fetch that inspects the API's error responses so onError can tell a
// 429 (rate-limit copy) apart from any other failure (error copy). useChat's
// onError only receives an Error, not the HTTP status — so we read the status
// here and throw an Error whose message carries the distinction.
const chatFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (!res.ok) {
    let code = "error";
    try {
      const body = (await res.clone().json()) as { error?: string };
      if (res.status === 429 || body?.error === "rate_limited") {
        code = "rate_limited";
      }
    } catch {
      if (res.status === 429) code = "rate_limited";
    }
    throw new Error(code);
  }
  return res;
};

function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function ChatConversation() {
  const searchParams = useSearchParams();
  // History is client-side only, held in useChat's in-memory state. There is no
  // persistence layer by design (no localStorage, no DB) — a page refresh
  // clears the conversation entirely. That's a pinned architecture choice, not
  // an oversight; don't "fix" it without a deliberate decision.
  const [errorKind, setErrorKind] = useState<"none" | "error" | "rate_limited">(
    "none",
  );

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", fetch: chatFetch }),
    onError: (error) => {
      const kind = error.message === "rate_limited" ? "rate_limited" : "error";
      setErrorKind(kind);
      track(kind === "rate_limited" ? "chat_rate_limited" : "chat_error");
    },
  });

  const sentMessageCount = useRef(0);

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    setErrorKind("none");
    track("chat_message_sent", {
      message_index: sentMessageCount.current,
      message: q,
    });
    sentMessageCount.current += 1;
    void sendMessage({ text: q });
  }

  // On mount, read ?q= from the sticky-bar redirect and send it as the first
  // message. The ref guard prevents a double-send under React strict mode.
  // The send is deferred to a microtask so the effect body doesn't call setState
  // synchronously (avoids a cascading render on mount).
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current) return;
    const q = searchParams.get("q");
    if (q && q.trim()) {
      autoSent.current = true;
      queueMicrotask(() => submit(q));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [input, setInput] = useState("");
  const isBusy = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;

  return (
    <Section divider="none">
      <Container className="py-16">
        <h1 className="font-sans text-[30px] font-semibold tracking-[-0.025em] text-ink">
          Ask about my work
        </h1>

        {/* Conversation */}
        <div className="mt-8 space-y-6">
          {!hasMessages && (
            <p className="max-w-[58ch] font-mono text-[13px] leading-relaxed text-faint">
              {EMPTY_STATE}
            </p>
          )}

          {messages.map((message) => {
            const text = textOf(message);
            if (!text) return null;
            return (
              <div
                key={message.id}
                className="max-w-[58ch] whitespace-pre-wrap font-mono text-[13px] leading-relaxed"
              >
                <span className="text-faint">
                  {message.role === "user" ? "you" : "assistant"}
                </span>
                <p
                  className={
                    message.role === "user"
                      ? "mt-1 text-ink"
                      : "mt-1 text-ink-soft"
                  }
                >
                  {text}
                </p>
              </div>
            );
          })}

          {/* Inline error / rate-limit states (styled distinctly, no ink
              border) so the user can retry without losing prior messages. */}
          {errorKind === "error" && (
            <p className="max-w-[58ch] font-mono text-[13px] leading-relaxed text-faint">
              {ERROR_STATE}
            </p>
          )}
          {errorKind === "rate_limited" && (
            <p className="max-w-[58ch] font-mono text-[13px] leading-relaxed text-faint">
              {RATE_LIMIT_STATE}
            </p>
          )}
        </div>

        {/* Suggested-question chips — live: clicking sends the question. */}
        {!hasMessages && (
          <div className="mt-8 flex flex-wrap gap-3">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => submit(q)}
                disabled={isBusy}
                className="border border-hairline px-3 py-1.5 font-mono text-xs text-ink-soft transition-colors hover:border-ink disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input row — strong ink border for emphasis, radius 0. */}
        <form
          className="mt-8 flex h-11 max-w-xl items-center border border-ink bg-surface-raised px-4 font-mono text-[13px]"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
            setInput("");
          }}
        >
          <span className="text-ink-soft">&gt;</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isBusy}
            placeholder="Ask a question about my work"
            className="ml-2 w-full flex-1 border-none bg-transparent text-ink outline-none placeholder:text-faint disabled:opacity-50"
          />
          <span className="text-faint">enter ↵</span>
        </form>

        <p className="mt-4 font-mono text-xs text-faint">{DISCLAIMER}</p>
      </Container>
    </Section>
  );
}

export default function ChatPage() {
  // useSearchParams must be wrapped in Suspense so /chat stays a static shell
  // (Next.js requirement), with the conversation rendered client-side.
  return (
    <Suspense fallback={null}>
      <ChatConversation />
    </Suspense>
  );
}
