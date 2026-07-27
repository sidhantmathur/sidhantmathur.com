"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  IDLE_LINES,
  JD_COPY,
  RAIL_ITEMS,
  SLASH_COMMANDS,
  SLUG_TO_RESUME,
  SOCIAL_LINKS,
  type RailItem,
} from "./shell-data";
import { Answer } from "./answer";
import { usePanelUrl } from "./use-panel-url";
import { PanelBody, panelTitle } from "./panel-body";
import { CopyButton } from "./copy-button";
import { InstrumentDeck, Seismograph, lastSettledRate } from "./instruments";
import { useTokenRate } from "./use-token-rate";
import { useTeletype } from "./use-teletype";
import { useIdle, useTypedText } from "./use-idle";
import { conversationToMarkdown, messageToMarkdown } from "@/lib/transcript";
import { permalinkFor } from "@/lib/permalink";
import { track } from "@/lib/analytics";
import { ExportDeck } from "./export-deck";
import { PrintSheet } from "./print-sheet";
import { ManualMode } from "./manual-mode";
import { RecruiterTldr } from "./recruiter-tldr";
import { costOfTurn, formatUsd, sumCosts } from "@/lib/pricing";
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
// Drafted for Sprint 5 (#18) and logged in docs/copy-ledger.md. Says three
// things, all of them checkable in this repo: this is a replay, it came out of
// the link rather than off a server, and it stopped being live when it was
// made.
const REPLAY_BANNER =
  "Replayed conversation. It was rebuilt from the link you opened — the site stored nothing, and this is a snapshot of what the model said then, not a live session.";
// Identity strings, hoisted so the status strip and the copied transcript's
// header can't drift apart. Not prose — a name and a URL.
const SITE_NAME = "Sidhant Mathur";
const SITE_URL = "https://sidhantmathur.com";
// Recruiter-tuned (#26, Track B) — a copy swap, per the decisions doc's note
// that these replace the old set rather than adding a mode. The old three were
// a demo of what the site can do; these are the first four things a recruiter
// asks, including the screening question ("does he need sponsorship") that
// otherwise costs an email and a day. Verbatim from docs/site-copy.md.
//
// None of them may trip `looksLikeJobPosting` or `looksLikeSiteQuestion` — a
// suggested question that forces a roleFit call or loads the repo corpus turns
// the site's own affordance into its worst path. Asserted in
// evals/track-b.test.mjs.
const SUGGESTED = [
  "Give me the 30-second version",
  "What has he shipped end to end?",
  "Is he a fit for a RevOps role at an AI-forward company?",
  "Does he need visa sponsorship?",
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
    turnLog,
    replayed,
  } = useConversation(model);

  usePanelUrl(panel, setPanel);

  // ---- Instruments (Sprint 2) ----------------------------------------------
  //
  // All three of these read the SAME string: the text of the streaming answer.
  // The seismograph samples how fast it grows, the teletype ticks when it does,
  // and neither needs a channel of its own. Nothing here can change what the
  // model does or what the reader has to do — see the note at the top of
  // instruments.tsx.
  const lastMessage = messages[messages.length - 1];
  const streamingText = lastMessage?.role === "assistant" ? textOf(lastMessage) : "";
  const rate = useTokenRate(streamingText, isBusy);
  const settledRate = lastSettledRate(turnLog);
  const { teletype, toggleTeletype } = useTeletype(streamingText, isBusy);
  const sessionCost = useMemo(
    () => sumCosts(turnLog.map((t) => (t.error ? null : costOfTurn(t.model, t.usage)))),
    [turnLog],
  );

  // Idle mode. Suspended while a turn is in flight — an answer arriving is not
  // an idle screen — and it never blocks anything: the input keeps focus and
  // the first keystroke ends it.
  const idle = useIdle(!isBusy);
  const [idleIndex, setIdleIndex] = useState(0);
  useEffect(() => {
    if (!idle) return;
    const id = window.setInterval(
      () => setIdleIndex((i) => (i + 1) % IDLE_LINES.length),
      14_000,
    );
    return () => window.clearInterval(id);
  }, [idle]);

  const [input, setInput] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFull, setSheetFull] = useState(false);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const [linkCopied, setLinkCopied] = useState(false);

  // ---- Export and the actions strip (Sprint 5) -----------------------------
  //
  // The link is held here rather than inside the export panel because the print
  // document carries it too, and because it has to be dropped the moment the
  // conversation moves on: a permalink describes the turns it was built from,
  // and one left on screen after another answer would be quietly wrong.
  // Derived rather than invalidated in an effect: the link is remembered with
  // the turn count it was built at, and stops being the current link the moment
  // another turn lands. No cascading render, and no window where the panel
  // shows a link that describes a shorter conversation.
  const [builtLink, setBuiltLink] = useState<{ link: string; at: number } | null>(null);
  const permalink = builtLink && builtLink.at === messages.length ? builtLink.link : null;
  const setPermalink = useCallback(
    (link: string | null) => setBuiltLink(link ? { link, at: messages.length } : null),
    [messages.length],
  );

  // #27's answer to the trigger problem: nothing appears, the strip that was
  // always there just gains a little weight — right after an action, which is
  // the highest-intent moment available and needs no guess at an ending.
  const [emphasis, setEmphasis] = useState(false);
  const emphasisTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpStrip = useCallback(() => {
    setEmphasis(true);
    if (emphasisTimer.current) clearTimeout(emphasisTimer.current);
    emphasisTimer.current = setTimeout(() => setEmphasis(false), 6000);
  }, []);
  useEffect(
    () => () => {
      if (emphasisTimer.current) clearTimeout(emphasisTimer.current);
    },
    [],
  );

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
      // Opening a citation is the other post-action moment the decisions doc
      // names — someone checking a source is someone taking this seriously.
      if (view.kind === "source") bumpStrip();
      setPanel(view);
      setRailOpen(false);
      if (isMobile) {
        setSheetFull(false);
        setSheetOpen(true);
      }
    },
    [isMobile, setPanel, bumpStrip],
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

  // One place that says what a copied conversation looks like, so the strip,
  // the export panel and the rail can't drift into three different documents.
  const conversationMarkdown = useCallback(
    () =>
      conversationToMarkdown(messages, {
        title: SITE_NAME,
        sourceUrl: SITE_URL,
        footer: DISCLAIMER,
        permalink: permalink ?? undefined,
      }),
    [messages, permalink],
  );

  // The strip's one-tap version of the export panel's Link section. On a
  // clipboard failure it opens the panel instead, where the link is visible and
  // selectable — silently doing nothing is the one outcome worth avoiding.
  const copyLink = useCallback(async () => {
    try {
      const link = await permalinkFor(`${window.location.origin}/`, messages);
      setPermalink(link);
      track("chat_permalink_created", { chars: link.length });
      await navigator.clipboard.writeText(link);
      bumpStrip();
      return true;
    } catch {
      openPanel({ kind: "export" });
      return false;
    }
  }, [messages, openPanel, bumpStrip, setPermalink]);

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

  // The deck is the one panel view that isn't built from content, so it's
  // rendered here rather than inside PanelBody — which would otherwise need
  // every instrument's state threaded through it.
  const panelContent =
    panel.kind === "export" ? (
      <ExportDeck
        messages={messages}
        title={SITE_NAME}
        sourceUrl={SITE_URL}
        footer={DISCLAIMER}
        permalink={permalink}
        onPermalink={setPermalink}
        onPrint={() => window.print()}
        onAction={bumpStrip}
      />
    ) : panel.kind === "instruments" ? (
      <InstrumentDeck
        turnLog={turnLog}
        budget={budget}
        model={model}
        rate={rate}
        teletype={teletype}
        onToggleTeletype={toggleTeletype}
        errorCopy={{ error: ERROR_STATE, rateLimited: RATE_LIMIT_STATE }}
      />
    ) : (
      <PanelBody panel={panel} onSubmitJd={submitJd} onOpenSource={openPanel} />
    );

  return (
    <>
      {/* ---- Print document --------------------------------------------
          A SIBLING of the shell, not a child: print hides the shell subtree
          entirely, so a document nested inside it would go with its parent
          and every print would come out blank. It lives in the DOM at all
          times and is display:none until print (the print block in
          app/globals.css), so Cmd-P — which nothing can reliably intercept —
          prints the document rather than the app, and the dialog never opens
          over a layout that hasn't happened yet. */}
      <PrintSheet
        messages={messages}
        title={SITE_NAME}
        sourceUrl={SITE_URL}
        permalink={permalink}
        footer={DISCLAIMER}
      />
      <div className="screen-only flex h-dvh flex-col bg-bg text-text [font-family:var(--font-geist-mono)]">
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
        {/* Tap target, not a glyph. The bare ☰ character rendered at the
            header's 11px was an ~11px target — well under the 44px iOS asks
            for, and it read as thin besides. This fills the full height of the
            strip (36px): a shade under spec, but the strip is the constraint
            and a taller header would cost the density everywhere else. Drawn
            as an SVG because the Unicode trigram renders inconsistently
            across platforms, hairline-thin on iOS in particular. */}
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          aria-label="Open navigation"
          className="-ml-1.5 flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center text-text-soft hover:text-accent lg:hidden"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 17 17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path d="M2.5 4.5h12M2.5 8.5h12M2.5 12.5h12" />
          </svg>
        </button>
        <Link href="/" className="text-text no-underline hover:text-accent">
          {SITE_NAME}
        </Link>
        <span className="hidden text-text-faint sm:inline">Toronto, ON</span>

        <div className="ml-auto flex items-center gap-4 text-text-faint">
          {/* The always-visible half of the instruments. One click opens the
              rest in the context panel — the readouts are the affordance, so
              nothing new has to be added to the page to advertise them.
              Hidden below md, where the rail item is the way in instead. */}
          <button
            type="button"
            onClick={() => openPanel({ kind: "instruments" })}
            title="Open the instruments"
            aria-label="Open the instruments"
            className="hidden items-center gap-4 transition-colors hover:text-accent md:flex"
          >
            <Stat label="turns" value={`${turns}/10`} />
            <Stat label="ttft" value={ttft == null ? "—" : `${ttft}ms`} />
            <span className="hidden lg:flex">
              <Seismograph rate={rate} settled={settledRate} />
            </span>
            <Stat label="est." value={formatUsd(sessionCost.total)} />
            {budget && (
              <Stat label={budget.tier} value={`${budget.remaining}/${budget.limit}`} />
            )}
          </button>
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
            {/* Idle dims the column rather than covering it. The conversation
                stays legible and every control stays live — this is a settle,
                not a screensaver. */}
            <div
              className={`mx-auto max-w-[68ch] transition-opacity duration-700 ${
                idle ? "opacity-70" : "opacity-100"
              }`}
            >
              {/* A replayed conversation says so, once, at the top of the
                  thing it is describing (#18). It must never be mistaken for
                  a live session, and the honest version of that is a line the
                  reader passes on the way in — not a badge in the chrome. */}
              {replayed && (
                <div className="mb-6 border-l-2 border-accent bg-raised px-3 py-2">
                  <p className="text-[12px] leading-relaxed text-text-soft">{REPLAY_BANNER}</p>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-1 text-[11px] text-text-faint hover:text-accent"
                  >
                    start a fresh one
                  </button>
                </div>
              )}

              {!hasMessages && (
                <div className="space-y-5">
                  <h1 className="max-w-[24ch] text-[clamp(21px,3.2vw,34px)] font-medium leading-[1.2] tracking-[-0.02em] text-text">
                    {HERO}
                  </h1>
                  <p className="text-[13px] leading-relaxed text-text-soft">{HERO_SUB}</p>
                  {/* #25 — the six-second scan, above the chips. See the note
                      in recruiter-tldr.tsx for why it is empty-state only. */}
                  <RecruiterTldr />
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
                          {/* The answer owns its own sources: markers out of
                              the prose, into the margin, and a source row
                              under it once the turn settles (Sprint 3). */}
                          <Answer
                            text={text}
                            settled={!isBusy || m.id !== lastId}
                            onOpenSource={openPanel}
                          />
                          {/* Tool citations and the copy affordance share one row.
                              The copy button stays visible rather than
                              hover-revealed — hover doesn't exist on touch,
                              and this is the only way an answer leaves the
                              page. */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {outs.map((o, i) => (
                              <Fragment key={i}>
                                <CitationChip
                                  out={o}
                                  latest={m.id === lastId}
                                  onOpen={openPanel}
                                />
                                {/* The resume chip opens the panel, where the
                                    PDF link sits below the chunks. Asking for
                                    the resume and being handed a panel to
                                    scroll is a step too many, so the file gets
                                    its own chip — a real anchor, so it works
                                    whether or not the model remembered to
                                    write a link in its sentence. */}
                                {o.type === "tool-showResume" && (
                                  <a
                                    href="/resume.pdf"
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`border px-2 py-1 text-[11px] no-underline transition-colors hover:border-accent hover:text-accent ${
                                      m.id === lastId
                                        ? "border-line-strong text-text-soft"
                                        : "border-line text-text-faint"
                                    }`}
                                  >
                                    ↓ PDF
                                  </a>
                                )}
                              </Fragment>
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
                {/* Out of turns is the one state where the thing this page is
                    for stops working, and it used to be one grey sentence.
                    Manual mode (#15) puts the corpus itself in its place — no
                    model, no tokens, the same material. */}
                {errorKind === "rate_limited" && (
                  <ManualMode headline={RATE_LIMIT_STATE} onOpenSource={openPanel} />
                )}
              </div>

              {idle && <IdleLine key={idleIndex} line={IDLE_LINES[idleIndex]!} />}
            </div>
          </div>

          {/* Input. The bottom padding keeps the row clear of the home
              indicator on notched iPhones, where it otherwise sits directly
              under the bar; it resolves to 0 everywhere else. */}
          <div className="relative shrink-0 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]">
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
                enterKeyHint="send"
                // 16px below md is not a style choice: iOS Safari zooms the
                // viewport into any field it focuses whose font-size is under
                // 16px, and it does not zoom back out. The row's other text
                // stays 13px, so this only shows up on the phone — where the
                // input wanted the extra size anyway. The alternative fix,
                // maximum-scale=1 in the viewport, also kills pinch-zoom for
                // everyone; that is not a trade worth making.
                className="ml-2 min-w-0 flex-1 bg-transparent text-[16px] text-text outline-none placeholder:text-text-faint md:text-[13px]"
              />
              <span className="hidden text-[11px] text-text-faint sm:inline">enter ↵</span>
              {/* Touch has no visible affordance for "press enter" and no
                  hardware key to press. The hint above is the desktop half of
                  this; below sm it becomes a real button. */}
              <button
                type="submit"
                disabled={!input.trim() || isBusy}
                aria-label="Send"
                className="-mr-1.5 flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center text-[15px] text-text-faint transition-colors hover:text-accent disabled:opacity-30 sm:hidden"
              >
                ↵
              </button>
            </form>

            {/* ---- Actions strip (#27) ---------------------------------
                Was a nudge fired at "session end", an event that doesn't
                exist on this site — visitors close tabs, they don't finish.
                So: a persistent one-line strip, quiet, present from the
                first turn, that gains a little weight after an action
                instead of interrupting. Nothing appears and nothing has to
                detect an ending. Scrolls horizontally rather than wrapping
                on a narrow phone, so the input row above it never moves. */}
            <div
              className={`flex h-8 items-center gap-4 overflow-x-auto whitespace-nowrap border-t px-4 text-[11px] transition-colors md:px-10 ${
                emphasis ? "border-accent/60" : "border-line"
              }`}
            >
              {hasMessages && (
                <>
                  <CopyButton
                    getText={conversationMarkdown}
                    label="copy"
                    copiedLabel="copied"
                    event="chat_copy_conversation"
                    className={emphasis ? "text-text-soft" : ""}
                    onCopied={bumpStrip}
                  />
                  <StripButton
                    label="export"
                    emphasis={emphasis}
                    onClick={() => openPanel({ kind: "export" })}
                  />
                  <StripButton
                    label={linkCopied ? "link copied" : "link"}
                    emphasis={emphasis}
                    onClick={() => {
                      void copyLink().then((ok) => {
                        if (!ok) return;
                        setLinkCopied(true);
                        window.setTimeout(() => setLinkCopied(false), 1600);
                      });
                    }}
                  />
                </>
              )}
              <StripButton
                label="paste a job description"
                emphasis={emphasis}
                onClick={() => openPanel({ kind: "jd" })}
              />
              {hasMessages && (
                <StripButton label="reset" emphasis={emphasis} onClick={reset} />
              )}
            </div>
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
                {panelContent}
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
              // Scrolls because the rail now carries the readouts and the
              // transcript controls the header and input row drop at this
              // width — on a short phone that is more than one screen, and
              // the overflow was landing on the controls at the bottom.
              className="w-72 overflow-y-auto overscroll-contain border-line bg-panel p-4 text-[11px] text-text [font-family:var(--font-geist-mono)]"
            >
              <SheetHeader className="p-0">
                <SheetTitle className="text-[11px] font-normal text-text-faint">
                  Index
                </SheetTitle>
              </SheetHeader>
              <RailContent onOpenPanel={openPanel} showHeading={false} />
              {/* The header readouts are hidden at this width, so the rail
                  carries the same four numbers. Tapping Instruments above
                  opens the full deck as a sheet. */}
              <div className="mt-4 border-t border-line pt-3 text-text-faint">
                <div>turns {turns}/10</div>
                <div>ttft {ttft == null ? "—" : `${ttft}ms`}</div>
                <div>est. {formatUsd(sessionCost.total)}</div>
                <div className="truncate">model {model}</div>
              </div>

              {/* The transcript controls used to be duplicated here, because
                  the input row dropped them below sm. The actions strip is
                  present at every width now, so this is one place fewer for
                  the same two buttons to drift apart. */}
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
                {panelContent}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
      </div>
    </>
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

// One action in the strip. Emphasis is a colour step, not a new element —
// the strip is the same shape before and after, which is the difference
// between weight and a notification.
function StripButton({
  label,
  emphasis,
  onClick,
}: {
  label: string;
  emphasis: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 transition-colors hover:text-accent ${
        emphasis ? "text-text-soft" : "text-text-faint"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span>{label}</span>
      <span className="tabular-nums text-text-soft">{value}</span>
    </span>
  );
}

// The idle one-liner types itself out and then holds. Deliberately the quietest
// thing on the page: it sits below the conversation, never above it.
function IdleLine({ line }: { line: string }) {
  const typed = useTypedText(line);
  return (
    <p className="pt-6 text-[12px] leading-relaxed text-text-faint">
      {typed}
      <span className="animate-pulse text-accent">▍</span>
    </p>
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
