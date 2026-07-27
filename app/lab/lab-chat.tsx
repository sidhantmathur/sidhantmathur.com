"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  RAIL_LINKS,
  RESUME_BY_ID,
  RESUME_SECTIONS,
  SLASH_COMMANDS,
  SLUG_TO_RESUME,
  SOCIAL_LINKS,
  type ResumeSection,
} from "./lab-data";

// ---------------------------------------------------------------------------
// Copy — verbatim from docs/site-copy.md, lifted from app/chat/chat-conversation.tsx
// and app/page.tsx. No new site copy is written in this prototype.
// ---------------------------------------------------------------------------
const HERO =
  "I build internal tools, revenue systems, and the occasional whole product.";
const EMPTY_STATE =
  "Ask me about my work at Nokia, A Darle 20, or anything on my resume.";
const DISCLAIMER =
  "AI-generated answers about my professional background. It can make mistakes — the resume is the authoritative version.";
const ERROR_STATE =
  "Something went wrong on my end. Give it another try in a moment.";
const RATE_LIMIT_STATE =
  "You've hit the message limit for now — the resume has everything in the meantime.";
const SUGGESTED = [
  "What did Sidhant build at Nokia?",
  "How does A Darle 20 work?",
  "Is he a fit for a solutions engineering role?",
];

// docs/site-copy.md → "Why this site is a chatbot". Marked DRAFT there:
// Sidhant rewrites it in his own voice, and this array follows that file.
const WHY_CHATBOT = [
  "A resume is a list of claims you have to take on faith. This is the same information, except you can interrogate it — ask what I actually did at Nokia, push back on whether the marketplace numbers mean anything, or find out where I'd struggle in the role you're hiring for.",
  "Every answer here is grounded in the same source files the resume is built from, and each one shows you which section it came from, so you can check the claim instead of trusting it.",
  "I also built it, which is most of the point. I'm not the strongest engineer you'll interview. What I'm good at is picking up an unfamiliar tool and getting something real and useful in front of people — so rather than write that down and hope you believe it, I made the thing you're reading it on.",
  "If you'd rather just read the resume, it's one click away in the panel.",
];

// Model string mirrors app/api/chat/route.ts. The selector is display-only in
// this prototype — switching it does NOT change the model the API uses, because
// the route hardcodes it. Wiring it means accepting a model id in the request
// body and allowlisting it server-side (cheap tiers only).
const MODELS = ["anthropic/claude-haiku-4.5", "google/gemini-2.5-flash", "openai/gpt-5-mini"];

const STORAGE_KEY = "lab.conversation.v1";

// Module scope: reading the clock is impure, and calling it inside the
// component body trips react-hooks/purity even from an event handler.
const nowMs = () => performance.now();

// ---------------------------------------------------------------------------

function textOf(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

type ToolOut = { type: string; state?: string; output?: unknown };

function toolOutputs(message: UIMessage): ToolOut[] {
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

type PanelView =
  | { kind: "none" }
  | { kind: "resume"; focus?: string }
  | { kind: "projects" }
  | { kind: "contact" }
  | { kind: "why" }
  | { kind: "roleFit"; data: RoleFit };

type RoleFit = {
  role: string;
  matches: { area: string; evidence: string }[];
  caveats?: string;
};

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

export function LabChat() {
  const [errorKind, setErrorKind] = useState<"none" | "error" | "rate_limited">("none");
  const [model, setModel] = useState(MODELS[0]);
  const [panel, setPanel] = useState<PanelView>({ kind: "none" });
  const [input, setInput] = useState("");
  const [ttft, setTtft] = useState<number | null>(null);

  // `hydrated` gates BOTH halves of persistence. Reading localStorage during
  // render made the server emit an empty conversation while the client emitted
  // the restored one — a hydration mismatch (the turn counter was the visible
  // symptom). So the first client render must match the server exactly: start
  // empty, restore after mount.
  const [hydrated, setHydrated] = useState(false);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat", fetch: chatFetch }),
    onError: (error) => {
      setErrorKind(error.message === "rate_limited" ? "rate_limited" : "error");
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const sentAt = useRef<number | null>(null);

  // Restore once, after mount.
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

  // Route tool output into the context panel instead of rendering it inline.
  // This is the whole point of the prototype: the assistant answers in prose,
  // and the evidence for that answer opens beside it.
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
    // Deferred to a microtask so the effect body doesn't setState synchronously.
    if (next) queueMicrotask(() => setPanel(next));
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function submit(text: string) {
    const q = text.trim();
    if (!q || isBusy) return;
    setErrorKind("none");
    stick.current = true;
    sentAt.current = nowMs();
    setTtft(null);
    void sendMessage({ text: q });
  }

  const slashQuery = input.startsWith("/") ? input.toLowerCase() : null;
  const slashMatches = slashQuery
    ? SLASH_COMMANDS.filter((c) => c.name.startsWith(slashQuery))
    : [];

  function runSlash(name: string) {
    const cmd = SLASH_COMMANDS.find((c) => c.name === name);
    if (!cmd) return;
    setInput("");
    if (cmd.kind === "panel") {
      if (cmd.panel === "resume") setPanel({ kind: "resume" });
      if (cmd.panel === "projects") setPanel({ kind: "projects" });
      if (cmd.panel === "contact") setPanel({ kind: "contact" });
      return;
    }
    if (cmd.message) submit(cmd.message);
  }

  function trySend() {
    const q = input.trim();
    if (!q) return;
    if (q.startsWith("/")) {
      const exact = SLASH_COMMANDS.find((c) => c.name === q);
      if (exact) return runSlash(exact.name);
      if (slashMatches.length === 1) return runSlash(slashMatches[0].name);
      return;
    }
    if (isBusy) return;
    submit(q);
    setInput("");
  }

  function reset() {
    setMessages([]);
    setPanel({ kind: "none" });
    setErrorKind("none");
    setTtft(null);
    lastToolKey.current = "";
  }

  const hasMessages = messages.length > 0;
  const awaitingReply =
    status === "submitted" ||
    (status === "streaming" && messages[messages.length - 1]?.role !== "assistant");
  const turns = messages.filter((m) => m.role === "user").length;
  const panelOpen = panel.kind !== "none";

  return (
    <div className="lab fixed inset-0 z-[100] flex flex-col bg-bg text-text [font-family:var(--font-geist-mono)] antialiased">
      {/* ---- Status strip -------------------------------------------------- */}
      <div className="flex h-9 shrink-0 items-center gap-4 border-b border-line bg-panel px-4 text-[11px]">
        <Link href="/" className="text-text no-underline hover:text-accent">
          Sidhant Mathur
        </Link>
        <span className="hidden text-text-faint sm:inline">Toronto, ON</span>

        <div className="ml-auto flex items-center gap-4 text-text-faint">
          <Stat label="turns" value={`${turns}/10`} />
          <Stat label="ttft" value={ttft == null ? "—" : `${ttft}ms`} />
          <label className="hidden items-center gap-1.5 md:flex">
            <span>model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="cursor-pointer border border-line-strong bg-raised px-1.5 py-0.5 text-[11px] text-text-soft outline-none focus:border-accent"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isBusy ? "bg-accent" : "bg-signal"
              }`}
            />
            {isBusy ? "streaming" : "ready"}
          </span>
        </div>
      </div>

      {/* ---- Body: rail | conversation | panel ----------------------------- */}
      <div className="flex min-h-0 flex-1">
        {/* Rail */}
        <nav className="hidden w-52 shrink-0 flex-col border-r border-line bg-panel p-4 text-[11px] lg:flex">
          <div className="text-text-faint">Index</div>
          <div className="mt-3 flex flex-col">
            {RAIL_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="border-b border-line py-2 text-text-soft no-underline transition-colors hover:text-accent"
              >
                {l.label} {l.external ? "↗" : "→"}
              </Link>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPanel({ kind: "resume" })}
            className="mt-4 border border-line-strong px-2 py-2 text-left text-text-soft transition-colors hover:border-accent hover:text-accent"
          >
            Open resume panel
          </button>

          <button
            type="button"
            onClick={() => setPanel({ kind: "why" })}
            className="mt-2 border border-line-strong px-2 py-2 text-left text-text-soft transition-colors hover:border-accent hover:text-accent"
          >
            Why is this site a chatbot?
          </button>

          <div className="mt-auto flex flex-col gap-2 pt-6">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-faint no-underline hover:text-accent"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        {/* Conversation */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-8 md:px-10">
            <div className="mx-auto max-w-[68ch]">
              {!hasMessages && (
                <div className="space-y-5">
                  <h1 className="max-w-[24ch] text-[clamp(22px,3.2vw,34px)] font-medium leading-[1.2] tracking-[-0.02em] text-text">
                    {HERO}
                  </h1>
                  <p className="text-[13px] leading-relaxed text-text-soft">{EMPTY_STATE}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SUGGESTED.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => submit(q)}
                        disabled={isBusy}
                        className="border border-line-strong px-2.5 py-1.5 text-[12px] text-text-soft transition-colors hover:border-accent hover:text-text disabled:opacity-40"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <p className="max-w-[58ch] pt-2 text-[11px] leading-relaxed text-text-faint">
                    {DISCLAIMER}
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {messages.map((m) => {
                  const text = textOf(m);
                  const outs = toolOutputs(m);
                  if (!text && !outs.length) return null;
                  return (
                    <div key={m.id} className="space-y-2">
                      {m.role === "user" ? (
                        <div className="flex justify-end">
                          <p className="max-w-[48ch] whitespace-pre-wrap border-l-2 border-accent bg-raised px-3 py-2 text-[13px] leading-relaxed text-text">
                            {text}
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-[13px] leading-[1.7] text-text-soft">
                            {text}
                          </p>
                          {outs.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {outs.map((o, i) => (
                                <CitationChip
                                  key={i}
                                  out={o}
                                  onOpen={(v) => setPanel(v)}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {awaitingReply && (
                  <p className="text-[13px] text-text-faint">
                    <span className="inline-block animate-pulse">reading the resume…</span>
                  </p>
                )}

                {errorKind === "error" && (
                  <p className="text-[13px] leading-relaxed text-text-faint">{ERROR_STATE}</p>
                )}
                {errorKind === "rate_limited" && (
                  <p className="text-[13px] leading-relaxed text-text-faint">
                    {RATE_LIMIT_STATE}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="relative shrink-0 border-t border-line bg-panel">
            {slashMatches.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 border-t border-line bg-panel">
                {slashMatches.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      runSlash(c.name);
                    }}
                    className="flex w-full items-baseline gap-3 px-5 py-2 text-left text-[12px] hover:bg-raised md:px-10"
                  >
                    <span className="text-accent">{c.name}</span>
                    <span className="text-text-faint">{c.hint}</span>
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex h-12 items-center px-5 text-[13px] md:px-10"
              onSubmit={(e) => {
                e.preventDefault();
                trySend();
              }}
            >
              <span className="text-accent">&gt;</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    trySend();
                  }
                  if (e.key === "Escape") setInput("");
                }}
                autoFocus
                placeholder="Ask a question about my work, or type / for commands"
                className="ml-2 min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-faint"
              />
              {hasMessages && (
                <button
                  type="button"
                  onClick={reset}
                  className="mr-3 text-[11px] text-text-faint hover:text-accent"
                >
                  reset
                </button>
              )}
              <span className="text-[11px] text-text-faint">enter ↵</span>
            </form>
          </div>
        </div>

        {/* Context panel */}
        {panelOpen && (
          <aside className="hidden w-[380px] shrink-0 flex-col border-l border-line bg-panel md:flex">
            <div className="flex h-9 shrink-0 items-center justify-between border-b border-line px-4 text-[11px]">
              <span className="text-text-faint">{panelTitle(panel)}</span>
              <button
                type="button"
                onClick={() => setPanel({ kind: "none" })}
                className="text-text-faint hover:text-accent"
              >
                close ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <PanelBody panel={panel} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// First tool output in a turn wins the panel.
function panelForTool(outs: ToolOut[]): PanelView | null {
  for (const out of outs) {
    if (out.type === "tool-showProject") {
      const slug = (out.output as { slug?: string })?.slug ?? "";
      const focus = SLUG_TO_RESUME[slug];
      return focus ? { kind: "resume", focus } : { kind: "projects" };
    }
    if (out.type === "tool-showResume") return { kind: "resume" };
    if (out.type === "tool-contactCard") return { kind: "contact" };
    if (out.type === "tool-roleFit")
      return { kind: "roleFit", data: out.output as RoleFit };
  }
  return null;
}

function panelTitle(panel: PanelView): string {
  switch (panel.kind) {
    case "resume":
      return "Resume";
    case "projects":
      return "Projects";
    case "contact":
      return "Contact";
    case "why":
      return "Why this site is a chatbot";
    case "roleFit":
      return `Role fit — ${panel.data.role}`;
    default:
      return "";
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="hidden items-center gap-1.5 sm:flex">
      <span>{label}</span>
      <span className="text-text-soft">{value}</span>
    </span>
  );
}

// A citation chip sits under the answer and reopens the evidence that answer
// was built from. This is the piece that makes the bot verifiable rather than
// merely plausible.
function CitationChip({
  out,
  onOpen,
}: {
  out: ToolOut;
  onOpen: (v: PanelView) => void;
}) {
  let label = "Source";
  let view: PanelView = { kind: "resume" };

  if (out.type === "tool-showProject") {
    const slug = (out.output as { slug?: string; title?: string })?.slug ?? "";
    const title = (out.output as { title?: string })?.title ?? "Project";
    label = title;
    const focus = SLUG_TO_RESUME[slug];
    view = focus ? { kind: "resume", focus } : { kind: "projects" };
  } else if (out.type === "tool-showResume") {
    label = "Resume";
    view = { kind: "resume" };
  } else if (out.type === "tool-contactCard") {
    label = "Contact";
    view = { kind: "contact" };
  } else if (out.type === "tool-roleFit") {
    const data = out.output as RoleFit;
    label = `Role fit — ${data.role}`;
    view = { kind: "roleFit", data };
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(view)}
      className="border border-line-strong px-2 py-1 text-[11px] text-text-faint transition-colors hover:border-accent hover:text-accent"
    >
      ↗ {label}
    </button>
  );
}

function PanelBody({ panel }: { panel: PanelView }) {
  if (panel.kind === "resume") {
    return (
      <div className="space-y-6">
        {RESUME_SECTIONS.map((s) => (
          <ResumeBlock key={s.id} section={s} focused={panel.focus === s.id} />
        ))}
        <Link
          href="/resume"
          className="inline-block border border-line-strong px-2 py-1 text-[11px] text-text-soft no-underline hover:border-accent hover:text-accent"
        >
          Full resume →
        </Link>
      </div>
    );
  }

  if (panel.kind === "projects") {
    return (
      <div className="space-y-4">
        {RAIL_LINKS.slice(2, 5).map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className="block border border-line-strong p-3 text-[12px] text-text-soft no-underline hover:border-accent"
          >
            {l.label} →
          </Link>
        ))}
      </div>
    );
  }

  if (panel.kind === "contact") {
    return (
      <div className="space-y-2">
        {SOCIAL_LINKS.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noreferrer"
            className="block border border-line-strong p-3 text-[12px] text-text-soft no-underline hover:border-accent"
          >
            {s.label} ↗
          </a>
        ))}
      </div>
    );
  }

  if (panel.kind === "why") {
    return (
      <div className="space-y-4">
        {WHY_CHATBOT.map((para, i) => (
          <p key={i} className="text-[12px] leading-relaxed text-text-soft">
            {para}
          </p>
        ))}
        <Link
          href="/colophon"
          className="inline-block border border-line-strong px-2 py-1 text-[11px] text-text-soft no-underline hover:border-accent hover:text-accent"
        >
          How it&apos;s built →
        </Link>
      </div>
    );
  }

  if (panel.kind === "roleFit") {
    const { matches, caveats } = panel.data;
    return (
      <div className="space-y-4">
        {matches.map((m, i) => (
          <div key={i} className="border-l-2 border-accent pl-3">
            <div className="text-[12px] text-text">{m.area}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-text-soft">{m.evidence}</p>
          </div>
        ))}
        {caveats && (
          <div className="border-t border-line pt-3">
            <div className="text-[11px] text-text-faint">Where it&apos;s a stretch</div>
            <p className="mt-1 text-[12px] leading-relaxed text-text-soft">{caveats}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function ResumeBlock({ section, focused }: { section: ResumeSection; focused: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focused]);

  return (
    <div
      ref={ref}
      className={`border-l-2 pl-3 transition-colors ${
        focused ? "border-accent" : "border-line"
      }`}
    >
      <div className={`text-[12px] ${focused ? "text-accent" : "text-text"}`}>
        {section.heading}
      </div>
      <div className="mt-0.5 text-[11px] text-text-faint">{section.meta}</div>
      <ul className="mt-2 space-y-2">
        {section.bullets.map((b, i) => (
          <li key={i} className="text-[12px] leading-relaxed text-text-soft">
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { RESUME_BY_ID };
