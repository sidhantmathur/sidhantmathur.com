"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  JD_COPY,
  RAIL_ITEMS,
  SLASH_COMMANDS,
  SLUG_TO_RESUME,
  SOCIAL_LINKS,
  type RailItem,
} from "./shell-data";
import { Markdown } from "./markdown";
import { usePanelUrl } from "./use-panel-url";
import { PanelBody, panelTitle } from "./panel-body";
import { CopyButton } from "./copy-button";
import { conversationToMarkdown, messageToMarkdown } from "@/lib/transcript";
import {
  textOf,
  toolOutputs,
  useConversation,
  type PanelView,
  type RoleFit,
  type ToolOut,
} from "./use-conversation";

// ---------------------------------------------------------------------------
// Copy — verbatim from docs/site-copy.md.
// ---------------------------------------------------------------------------
const HERO = "I learn what the problem needs, then I build the thing.";
const HERO_SUB = "Ask what you'd ask on a call.";
const DISCLAIMER =
  "AI-generated answers about my professional background. It can make mistakes — the resume is the authoritative version.";
const ERROR_STATE =
  "Something went wrong on my end. Give it another try in a moment.";
const RATE_LIMIT_STATE =
  "You've hit the message limit for now — the resume has everything in the meantime.";
// Identity strings, hoisted so the status strip and the copied transcript's
// header can't drift apart. Not prose — a name and a URL.
const SITE_NAME = "Sidhant Mathur";
const SITE_URL = "https://sidhantmathur.com";
const SUGGESTED = [
  "What did Sidhant build at Nokia?",
  "How does A Darle 20 work?",
  "Is he a fit for a solutions engineering role?",
];

// Must stay a subset of the `MODELS` allowlist in app/api/chat/route.ts — an id
// that isn't on the server list silently falls back to the default rather than
// erroring, so a mismatch here is invisible. Order is the dropdown order; the
// first entry is what the shell selects on load.
//
// The last entry is the `premium` tier. Selecting it switches the header budget
// strip from "standard n/20" to "premium n/5", which is the point of showing it.
const MODELS = [
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5-mini",
  "google/gemini-3.5-flash-lite",
  "deepseek/deepseek-v4-flash",
  "openai/gpt-5.6-luna",
];

const PANEL_WIDTH_KEY = "panel.width.v1";
const PANEL_MIN = 300;
const PANEL_MAX = 640;
const PANEL_DEFAULT = 380;

export function AppShell() {
  const [model, setModel] = useState<string>(MODELS[0]);

  const {
    messages,
    submit,
    reset,
    isBusy,
    awaitingReply,
    errorKind,
    ttft,
    panel,
    setPanel,
    turns,
    budget,
  } = useConversation(model);

  usePanelUrl(panel, setPanel);

  const [input, setInput] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFull, setSheetFull] = useState(false);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);

  // Below lg the rail and panel become sheets. Rendering them only on mobile
  // keeps Radix from mounting a portal + overlay over the desktop layout.
  // Starts false so the first client render matches the server; both sheets are
  // closed at mount, so there is nothing to flash.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = (m: MediaQueryList | MediaQueryListEvent) =>
      queueMicrotask(() => setIsMobile(m.matches));
    apply(mq);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Panel width is restored after mount for the same hydration reason.
  useEffect(() => {
    const raw = window.localStorage.getItem(PANEL_WIDTH_KEY);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n)) {
      queueMicrotask(() => setPanelWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, n))));
    }
  }, []);

  // Opening a view from a deliberate action (rail item, citation chip) also
  // raises the sheet on mobile. Tool calls only set the view — see the note in
  // use-conversation.ts about why they must not open the sheet.
  const openPanel = useCallback(
    (view: PanelView) => {
      setPanel(view);
      setRailOpen(false);
      if (isMobile) {
        setSheetFull(false);
        setSheetOpen(true);
      }
    },
    [isMobile, setPanel],
  );

  const closePanel = useCallback(() => {
    setPanel({ kind: "none" });
    setSheetOpen(false);
  }, [setPanel]);

  // Stick-to-bottom: streaming keeps the view pinned while the reader is at the
  // bottom, and stops yanking them down once they scroll up to reread.
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submitJd = useCallback(
    (text: string) => {
      stick.current = true;
      submit(`${JD_COPY.prefix}\n\n${text}`);
      setSheetOpen(false);
      setPanel({ kind: "none" });
    },
    [submit, setPanel],
  );

  function onScroll() {
    const el = scrollRef.current;
    if (el) stick.current = el.scrollHeight - el.clientHeight - el.scrollTop < 120;
  }

  const slashQuery = input.startsWith("/") ? input.toLowerCase() : null;
  const slashMatches = slashQuery
    ? SLASH_COMMANDS.filter((c) => c.name.startsWith(slashQuery))
    : [];

  function runSlash(name: string) {
    const cmd = SLASH_COMMANDS.find((c) => c.name === name);
    if (!cmd) return;
    setInput("");
    if (cmd.kind === "panel" && cmd.panel) return openPanel({ kind: cmd.panel } as PanelView);
    if (cmd.message) {
      stick.current = true;
      submit(cmd.message);
    }
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
    stick.current = true;
    submit(q);
    setInput("");
  }

  // Drag-to-resize. Hand-rolled rather than pulling in react-resizable-panels
  // for one divider.
  const dragging = useRef(false);
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragging.current) return;
      const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, window.innerWidth - e.clientX));
      setPanelWidth(next);
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
      try {
        window.localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth));
      } catch {
        /* persistence is a nicety */
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [panelWidth]);

  const hasMessages = messages.length > 0;
  const panelOpen = panel.kind !== "none";
  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className="flex h-dvh flex-col bg-bg text-text [font-family:var(--font-geist-mono)]">
      {/* Skip link. The rail is ~10 links deep and sits before the input in
          tab order, so a keyboard user otherwise tabs through the entire nav
          to reach the only call to action. Visually hidden until focused. */}
      <a
        href="#ask"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:border focus:border-accent focus:bg-panel focus:px-3 focus:py-1.5 focus:text-[12px] focus:text-text focus:no-underline"
      >
        Skip to the question box
      </a>

      {/* ---- Status strip ------------------------------------------------- */}
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 text-[11px] md:px-4">
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          aria-label="Open navigation"
          className="text-text-soft hover:text-accent lg:hidden"
        >
          ☰
        </button>
        <Link href="/" className="text-text no-underline hover:text-accent">
          {SITE_NAME}
        </Link>
        <span className="hidden text-text-faint sm:inline">Toronto, ON</span>

        <div className="ml-auto flex items-center gap-4 text-text-faint">
          <Stat label="turns" value={`${turns}/10`} />
          <Stat label="ttft" value={ttft == null ? "—" : `${ttft}ms`} />
          {budget && (
            <Stat label={budget.tier} value={`${budget.remaining}/${budget.limit}`} />
          )}
          <label className="hidden items-center gap-1.5 xl:flex">
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
            <span className="hidden sm:inline">{isBusy ? "streaming" : "ready"}</span>
          </span>
        </div>
      </header>

      {/* ---- Body --------------------------------------------------------- */}
      <div className="flex min-h-0 flex-1">
        {/* Rail — desktop */}
        <nav className="hidden w-56 shrink-0 flex-col border-r border-line bg-panel p-4 text-[11px] lg:flex">
          <RailContent onOpenPanel={openPanel} />
        </nav>

        {/* Conversation */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-8 md:px-10"
          >
            <div className="mx-auto max-w-[68ch]">
              {!hasMessages && (
                <div className="space-y-5">
                  <h1 className="max-w-[24ch] text-[clamp(21px,3.2vw,34px)] font-medium leading-[1.2] tracking-[-0.02em] text-text">
                    {HERO}
                  </h1>
                  <p className="text-[13px] leading-relaxed text-text-soft">{HERO_SUB}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SUGGESTED.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          stick.current = true;
                          submit(q);
                        }}
                        disabled={isBusy}
                        className="border border-line-strong px-2.5 py-1.5 text-left text-[12px] text-text-soft transition-colors hover:border-accent hover:text-text disabled:opacity-40"
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
                          <Markdown text={text} />
                          {/* Citations and the copy affordance share one row.
                              The copy button stays visible rather than
                              hover-revealed — hover doesn't exist on touch,
                              and this is the only way an answer leaves the
                              page. */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {outs.map((o, i) => (
                              <CitationChip
                                key={i}
                                out={o}
                                latest={m.id === lastId}
                                onOpen={openPanel}
                              />
                            ))}
                            {!isBusy && (
                              <CopyButton
                                getText={() => messageToMarkdown(m)}
                                label="copy"
                                event="chat_copy_message"
                              />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {awaitingReply && (
                  <p className="animate-pulse text-[13px] text-text-faint">reading the resume…</p>
                )}
                {errorKind === "error" && (
                  <p className="text-[13px] leading-relaxed text-text-faint">{ERROR_STATE}</p>
                )}
                {errorKind === "rate_limited" && (
                  <p className="text-[13px] leading-relaxed text-text-faint">{RATE_LIMIT_STATE}</p>
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
                    className="flex w-full items-baseline gap-3 px-4 py-2 text-left text-[12px] hover:bg-raised md:px-10"
                  >
                    <span className="text-accent">{c.name}</span>
                    <span className="text-text-faint">{c.hint}</span>
                  </button>
                ))}
              </div>
            )}
            <form
              className="flex h-12 items-center px-4 text-[13px] md:px-10"
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
                id="ask"
                placeholder="Ask a question, or type / for commands"
                aria-label="Ask a question"
                className="ml-2 min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-faint"
              />
              {hasMessages && (
                <>
                  <CopyButton
                    getText={() =>
                      conversationToMarkdown(messages, {
                        title: SITE_NAME,
                        sourceUrl: SITE_URL,
                        footer: DISCLAIMER,
                      })
                    }
                    label="copy all"
                    copiedLabel="copied all"
                    event="chat_copy_conversation"
                    className="mr-3"
                  />
                  <button
                    type="button"
                    onClick={reset}
                    className="mr-3 text-[11px] text-text-faint hover:text-accent"
                  >
                    reset
                  </button>
                </>
              )}
              <span className="hidden text-[11px] text-text-faint sm:inline">enter ↵</span>
            </form>
          </div>
        </div>

        {/* Context panel — desktop, resizable */}
        {panelOpen && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panel"
              onPointerDown={() => {
                dragging.current = true;
                document.body.style.userSelect = "none";
              }}
              onDoubleClick={() => setPanelWidth(PANEL_DEFAULT)}
              className="hidden w-1 shrink-0 cursor-col-resize bg-line transition-colors hover:bg-accent lg:block"
            />
            <aside
              style={{ width: panelWidth }}
              className="hidden shrink-0 flex-col border-l border-line bg-panel lg:flex"
            >
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-line px-4 text-[11px]">
                <span className="truncate text-text-faint">{panelTitle(panel)}</span>
                <button
                  type="button"
                  onClick={closePanel}
                  className="shrink-0 text-text-faint hover:text-accent"
                >
                  close ✕
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <PanelBody panel={panel} onSubmitJd={submitJd} />
              </div>
            </aside>
          </>
        )}
      </div>

      {/* ---- Mobile sheets ------------------------------------------------ */}
      {isMobile && (
        <>
          <Sheet open={railOpen} onOpenChange={setRailOpen}>
            <SheetContent
              side="left"
              className="w-72 border-line bg-panel p-4 text-[11px] text-text [font-family:var(--font-geist-mono)]"
            >
              <SheetHeader className="p-0">
                <SheetTitle className="text-[11px] font-normal text-text-faint">
                  Index
                </SheetTitle>
              </SheetHeader>
              <RailContent onOpenPanel={openPanel} showHeading={false} />
              <div className="mt-4 border-t border-line pt-3 text-text-faint">
                <div>turns {turns}/10</div>
                <div>ttft {ttft == null ? "—" : `${ttft}ms`}</div>
                <div className="truncate">model {model}</div>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={sheetOpen && panelOpen} onOpenChange={setSheetOpen}>
            <SheetContent
              side="bottom"
              style={{ height: sheetFull ? "88dvh" : "52dvh" }}
              className="border-line bg-panel p-0 text-text transition-[height] duration-200 [font-family:var(--font-geist-mono)]"
            >
              <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-line px-4 py-2">
                <SheetTitle className="truncate text-[11px] font-normal text-text-faint">
                  {panelTitle(panel)}
                </SheetTitle>
                <button
                  type="button"
                  onClick={() => setSheetFull((v) => !v)}
                  className="shrink-0 text-[11px] text-text-faint hover:text-accent"
                >
                  {sheetFull ? "collapse ↓" : "expand ↑"}
                </button>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <PanelBody panel={panel} onSubmitJd={submitJd} />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}

function RailContent({
  onOpenPanel,
  showHeading = true,
}: {
  onOpenPanel: (v: PanelView) => void;
  showHeading?: boolean;
}) {
  return (
    <>
      {showHeading && <div className="text-text-faint">Index</div>}
      <div className={`flex flex-col ${showHeading ? "mt-3" : "mt-2"}`}>
        {RAIL_ITEMS.map((item) => (
          <RailLink key={item.label} item={item} onOpenPanel={onOpenPanel} />
        ))}
      </div>
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-6">
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
    </>
  );
}

function RailLink({
  item,
  onOpenPanel,
}: {
  item: RailItem;
  onOpenPanel: (v: PanelView) => void;
}) {
  const cls =
    "border-b border-line py-2 text-left text-text-soft no-underline transition-colors hover:text-accent";

  if (item.external && item.href) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={cls}>
        {item.label} ↗
      </a>
    );
  }

  // Rendered as a real anchor so cmd-click, middle-click and "open in new tab"
  // reach the standalone page, and so crawlers see a link. A plain left-click
  // is intercepted and opens the panel instead; usePanelUrl pushes the same
  // href into the address bar.
  if (item.view && item.href) {
    return (
      <a
        href={item.href}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onOpenPanel(item.view as PanelView);
        }}
        className={cls}
      >
        {item.label} →
      </a>
    );
  }

  if (item.view) {
    return (
      <button type="button" onClick={() => onOpenPanel(item.view as PanelView)} className={cls}>
        {item.label}
      </button>
    );
  }

  return (
    <Link href={item.href ?? "/"} className={cls}>
      {item.label} →
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="hidden items-center gap-1.5 md:flex">
      <span>{label}</span>
      <span className="text-text-soft">{value}</span>
    </span>
  );
}

// Sits under an answer and reopens the evidence it was built from. On mobile
// this is the ONLY way into the panel, so the newest turn's chips are marked.
function CitationChip({
  out,
  latest,
  onOpen,
}: {
  out: ToolOut;
  latest: boolean;
  onOpen: (v: PanelView) => void;
}) {
  let label = "Source";
  let view: PanelView = { kind: "resume" };

  if (out.type === "tool-showProject") {
    const o = out.output as { slug?: string; title?: string };
    label = o?.title ?? "Project";
    // Dell has no resume section of its own, so it falls back to the list.
    const focus = SLUG_TO_RESUME[o?.slug ?? ""];
    view = focus ? { kind: "resume", focus } : { kind: "projects" };
  } else if (out.type === "tool-showResume") {
    label = "Resume";
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
      className={`border px-2 py-1 text-[11px] transition-colors hover:border-accent hover:text-accent ${
        latest ? "border-line-strong text-text-soft" : "border-line text-text-faint"
      }`}
    >
      ↗ {label}
    </button>
  );
}
