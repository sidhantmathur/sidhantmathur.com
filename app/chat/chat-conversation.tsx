"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { track } from "@/lib/analytics";
import {
  ProjectCard,
  type ProjectCardData,
} from "@/components/chat/tools/project-card";
import {
  ResumeCard,
  type ResumeCardData,
} from "@/components/chat/tools/resume-card";
import {
  RoleFitCard,
  type RoleFitCardData,
} from "@/components/chat/tools/role-fit-card";
import {
  ContactCard,
  type ContactCardData,
} from "@/components/chat/tools/contact-card";

// Copy strings — verbatim from docs/site-copy.md.
const EMPTY_STATE =
  "Ask me about my work at Nokia, A Darle 20, or anything on my resume.";
const ERROR_STATE =
  "Something went wrong on my end. Give it another try in a moment.";
const RATE_LIMIT_STATE =
  "You've hit the message limit for now — the resume has everything in the meantime.";
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

// Tool invocations arrive as typed message parts: `part.type` is
// `tool-<name>` and the part carries a `state` plus `input`/`output` fields
// (ai@7, v5-era wire format). We render a card only once the tool has
// executed (`state === 'output-available'`); while the state is
// 'input-streaming' / 'input-available' we render nothing (the model is still
// deciding / the args are still arriving). 'output-error' is left silent — the
// model's own text answer still renders, so the turn degrades gracefully.
function ToolPart({ part }: { part: UIMessage["parts"][number] }) {
  const type = part.type;
  if (typeof type !== "string" || !type.startsWith("tool-")) return null;

  // Narrow to the executed-output shape. Non-output states render nothing.
  const p = part as {
    type: string;
    state?: string;
    output?: unknown;
  };
  if (p.state !== "output-available" || p.output == null) return null;

  switch (type) {
    case "tool-showProject":
      return <ProjectCard data={p.output as ProjectCardData} />;
    case "tool-showResume":
      return <ResumeCard data={p.output as ResumeCardData} />;
    case "tool-roleFit":
      return <RoleFitCard data={p.output as RoleFitCardData} />;
    case "tool-contactCard":
      return <ContactCard data={p.output as ContactCardData} />;
    default:
      return null;
  }
}

export function ChatConversation() {
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

  // Stick-to-bottom auto-scroll (window scroll — the conversation lives in
  // normal page flow with the input fixed at the viewport bottom). While the
  // reader is at (or near) the bottom, each new streamed chunk keeps the page
  // pinned to the bottom; once they scroll up to reread something, streaming
  // no longer yanks them back down. Sending a message always re-pins.
  const stickToBottom = useRef(true);

  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      stickToBottom.current =
        el.scrollHeight - window.innerHeight - window.scrollY < 120;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (stickToBottom.current) {
      window.scrollTo({ top: document.documentElement.scrollHeight });
    }
  }, [messages]);

  const [input, setInput] = useState("");
  const isBusy = status === "submitted" || status === "streaming";

  function submit(text: string) {
    const q = text.trim();
    if (!q || isBusy) return;
    setErrorKind("none");
    stickToBottom.current = true;
    track("chat_message_sent", {
      message_index: sentMessageCount.current,
      message: q,
    });
    sentMessageCount.current += 1;
    void sendMessage({ text: q });
  }

  // On mount, read ?q= from the launcher-bar redirect and send it as the first
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

  // Send from the input box: clear it only when the message actually goes out
  // (submit() no-ops while a reply is streaming — don't eat the typed text).
  function trySend() {
    const q = input.trim();
    if (!q || isBusy) return;
    submit(q);
    setInput("");
  }
  const hasMessages = messages.length > 0;
  // Show a pending indicator between send and the first streamed token.
  const awaitingReply =
    status === "submitted" ||
    (status === "streaming" &&
      messages[messages.length - 1]?.role !== "assistant");

  return (
    <>
      {/* Conversation */}
      <div className="mt-8 space-y-6">
        {!hasMessages && (
          <p className="max-w-[58ch] font-mono text-[13px] leading-relaxed text-muted">
            {EMPTY_STATE}
          </p>
        )}

        {messages.map((message) => {
          const text = textOf(message);
          // Tool cards (assistant only) render at full width, outside the
          // 58ch prose column, in message-part order.
          const toolParts = message.parts.filter(
            (p) => typeof p.type === "string" && p.type.startsWith("tool-"),
          );
          if (!text && toolParts.length === 0) return null;
          return (
            <div key={message.id} className="space-y-4">
              {text &&
                (message.role === "user" ? (
                  // User turns: right-aligned surface block, chat-app style.
                  <div className="flex justify-end">
                    <p className="max-w-[48ch] whitespace-pre-wrap border border-hairline bg-surface px-3 py-2 font-mono text-[13px] leading-relaxed text-ink">
                      {text}
                    </p>
                  </div>
                ) : (
                  // Assistant turns: plain left-aligned prose column.
                  <p className="max-w-[58ch] whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink-soft">
                    {text}
                  </p>
                ))}
              {toolParts.map((part, i) => (
                <ToolPart key={`${message.id}-tool-${i}`} part={part} />
              ))}
            </div>
          );
        })}

        {awaitingReply && (
          <p aria-hidden className="font-mono text-[13px] text-faint">
            &hellip;
          </p>
        )}

        {/* Inline error / rate-limit states (styled distinctly, no ink
            border) so the user can retry without losing prior messages. */}
        {errorKind === "error" && (
          <p className="max-w-[58ch] font-mono text-[13px] leading-relaxed text-muted">
            {ERROR_STATE}
          </p>
        )}
        {errorKind === "rate_limited" && (
          <p className="max-w-[58ch] font-mono text-[13px] leading-relaxed text-muted">
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

      {/* Input — fixed dark bar at the viewport bottom, in the exact position
          (and style) of the site-wide sticky launcher bar, which is hidden on
          this route. The bar visually carries over from every other page; here
          it is the live chat input. Typing stays enabled while a reply streams
          (submit is guarded), matching standard chat-app behavior. */}
      <form
        className="fixed inset-x-0 bottom-0 z-50 border-t border-ink bg-ink px-6 md:px-12"
        onSubmit={(e) => {
          e.preventDefault();
          trySend();
        }}
      >
        <div className="flex h-11 items-center font-mono text-[13px]">
          <span className="text-band-muted">&gt;</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            // Explicit Enter handling — implicit form submission is skipped
            // by some input methods (IMEs, automation, some mobile keyboards).
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                trySend();
              }
            }}
            placeholder="Ask a question about my work"
            autoFocus
            className="ml-2 w-full flex-1 border-none bg-transparent text-paper outline-none placeholder:text-band-muted"
          />
          <span className="text-band-muted">enter ↵</span>
          {/* Guarantees implicit Enter-to-submit across browsers/input methods. */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </div>
      </form>
    </>
  );
}
