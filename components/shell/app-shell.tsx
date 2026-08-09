"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
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
import { panelTitle } from "./panel-title";
import { CopyButton } from "./copy-button";
import { Seismograph, lastSettledRate } from "./instruments";
import { useTokenRate } from "./use-token-rate";
import { useTeletype } from "./use-teletype";
import { useHydrated } from "./use-hydrated";
import { useIdleReady } from "./use-idle-ready";
import { useIdle } from "./use-idle";
import { useElapsed } from "./use-elapsed";
import { PhaseLine } from "./phase-line";
import { AmbientBackdrop } from "./ambient-backdrop";
import { TurnError } from "./turn-error";
import { conversationToMarkdown, messageToMarkdown } from "@/lib/transcript";
import { permalinkFor } from "@/lib/permalink";
import { track } from "@/lib/analytics";
import { RecruiterTldr } from "./recruiter-tldr";
import { SUGGESTED_QUESTIONS as SUGGESTED } from "@/content/recruiter";
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
// What does NOT ship in the entry chunk
// ---------------------------------------------------------------------------
// Measured on the throttled mobile profile, the homepage's first load was
// bandwidth-bound rather than CPU-bound: three quarters of a megabyte on the
// wire, and 3.8 seconds between the page painting and the page working. Most of
// what was arriving in that window could not be used in it.
//
// So everything below loads on demand. The test each one passes is the same:
// can a visitor reach it without first doing something? If the answer is no —
// a panel has to be opened, a turn has to fail, a sheet has to be raised — it
// has no business being in the bytes that stand between the visitor and a
// working composer.
//
// `ssr: false` throughout, and not as an afterthought. These render nothing on
// the server today (every one of them is behind client state), so pre-rendering
// them would add markup for something the visitor cannot yet see, which is the
// whole problem this pass exists to fix.
//
// The two DELIBERATE exceptions, so nobody re-splits them by reflex:
//   answer.tsx    on the streaming path. A lazy chunk fetched at the moment the
//                 first token lands is a stall in the one place the site is
//                 asking to be judged.
//   recruiter-tldr / the empty state generally — it IS the first screen.

// The panel's content. The heaviest module in the shell by a wide margin:
// three MDX case studies, the knowledge base, the repo corpus and the
// system-prompt builder. Nothing here is reachable without opening a panel.
const PanelBody = dynamic(() => import("./panel-body").then((m) => m.PanelBody), {
  ssr: false,
});

// Conversation state rather than content, and both need a conversation first.
const ExportDeck = dynamic(() => import("./export-deck").then((m) => m.ExportDeck), {
  ssr: false,
});
const InstrumentDeck = dynamic(
  () => import("./instruments").then((m) => m.InstrumentDeck),
  { ssr: false },
);

// The out-of-turns state. Carries the whole knowledge base, and most visitors
// will never see it.
const ManualMode = dynamic(() => import("./manual-mode").then((m) => m.ManualMode), {
  ssr: false,
});

// Radix's dialog, and below lg only. Mounted on the first sheet-opening tap,
// or at idle, whichever comes first — so the chunk is warm long before anyone
// reaches for it, and a desktop never fetches it at all. See mobile-sheets.tsx.
const MobileSheets = dynamic(
  () => import("./mobile-sheets").then((m) => m.MobileSheets),
  { ssr: false },
);

// The print document. Mounted once the page has gone idle rather than on an
// interaction: nothing can reliably intercept Cmd-P, so it has to already be in
// the DOM when the dialog opens — it just doesn't have to be there before the
// composer works. See use-idle-ready.ts.
const PrintSheet = dynamic(() => import("./print-sheet").then((m) => m.PrintSheet), {
  ssr: false,
});

// ---------------------------------------------------------------------------
// Copy — verbatim from docs/site-copy.md.
// ---------------------------------------------------------------------------
const HERO = "I learn what the problem needs, then I build the thing.";
const HERO_SUB = "Ask what you'd ask on a call.";
const DISCLAIMER =
  "AI-generated answers about my professional background. It can make mistakes — the resume is the authoritative version.";
// The error state used to be one string, here. It is now one string per error
// class, in `lib/chat-telemetry.ts` beside the classes themselves, rendered by
// TurnError — a dropped connection on a phone and a misconfigured server are
// not the same news, and the site already knew which one it was.
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

// How long a turn runs before the shell offers to abandon it. Roughly double a
// normal answer's wait — early enough to be a rescue, late enough not to be a
// suggestion that something is wrong.
const STALL_HINT_SECONDS = 8;

const PANEL_WIDTH_KEY = "panel.width.v1";
const PANEL_MIN = 300;
const PANEL_MAX = 640;
const PANEL_DEFAULT = 380;

export function AppShell() {
  // Everything on this page that needs JavaScript is gated on this. See
  // use-hydrated.ts for what the ungated version looked like on slow wifi.
  const hydrated = useHydrated();
  // The two things that must exist before they are asked for, but must not be
  // part of what the visitor waits for. See use-idle-ready.ts.
  const idleReady = useIdleReady();
  const [model, setModel] = useState<string>(MODELS[0]);

  const {
    messages,
    submit,
    retry,
    stop,
    reset,
    isBusy,
    phase,
    errorKind,
    errorClass,
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
  // The fourth reading of the same event. Unlike the three above it survives
  // the turn ending, because the finished duration is the interesting number.
  const elapsed = useElapsed(isBusy);
  // Past this, the wait has become a question and the reader gets a way out of
  // it. See the button beside the phase line.
  const stallable = isBusy && elapsed != null && elapsed >= STALL_HINT_SECONDS;
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

  // ---- What assistive tech is told ----------------------------------------
  //
  // A streamed answer arrives silently. The prose appears in the transcript a
  // token at a time, which is exactly the wrong thing to put in a live region —
  // a screen reader would read the answer over itself for the length of the
  // turn — so nothing was in one, and the result was that a turn finished with
  // no announcement of any kind. A blind visitor had to guess when to go and
  // read, or tab away and back to find out.
  //
  // So: one polite announcement per completed turn, and the answer itself stays
  // out of the region so it is read once, on purpose, when the reader navigates
  // to it. The turn number rides along because it makes each announcement a
  // distinct string — a live region does not re-announce text identical to what
  // it already holds, so "Answer complete." twice in a row would be said once.
  //
  // Failures do NOT come through here. TurnError carries role="alert", which is
  // the assertive counterpart and interrupts rather than waits, which is right
  // for a turn that did not happen.
  const [announcement, setAnnouncement] = useState("");
  // Counted, not edge-triggered. The first version watched `isBusy` for a
  // true→false transition and missed the announcement entirely on a fast turn,
  // where the whole answer arrives inside one render batch and there is no
  // intermediate commit to observe — caught by the mocked-stream check in
  // scripts/a11y-audit.mjs, which is exactly the case a live model on a good
  // connection produces and a developer on localhost never notices. Counting
  // settled answers has no such window: whenever the shell is idle and there is
  // one more finished answer than was last announced, that is the event.
  const announcedCount = useRef(0);
  useEffect(() => {
    if (isBusy) return;
    const answered = messages.filter((m) => m.role === "assistant" && textOf(m)).length;
    // Fewer than before means the conversation was reset, which is not an
    // answer and must not leave the counter high enough to swallow the next one.
    if (answered <= announcedCount.current) {
      announcedCount.current = answered;
      return;
    }
    announcedCount.current = answered;
    // The error block and the rate-limit block announce themselves; an aborted
    // turn was the reader's own doing and renders nothing on purpose.
    //
    // `!== "none"`, and the string is the whole point: errorKind is a union of
    // three STRINGS, so a truthiness test on it is true even when nothing has
    // gone wrong. The first version of this guard read `if (errorKind) return`
    // and silently suppressed every announcement the feature exists to make.
    if (errorKind !== "none") return;
    queueMicrotask(() => setAnnouncement(`Answer ${answered} complete.`));
  }, [isBusy, errorKind, messages]);

  const [input, setInput] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  // ---- Where focus goes when a sheet closes --------------------------------
  //
  // Measured, not assumed: closing the rail sheet dropped focus on <body>, which
  // strands a keyboard user at the top of the document with no idea the sheet
  // ever existed. The dialog primitive is supposed to hand focus back to
  // whatever opened it and did not, so the shell does it itself — it is two
  // refs, and it is the difference between a modal a keyboard can use and one
  // it can only fall out of.
  const railTriggerRef = useRef<HTMLButtonElement>(null);
  const panelOpenerRef = useRef<HTMLElement | null>(null);
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
      // Whatever was focused when the panel was asked for. Read before any
      // state changes, because the element may be inside a sheet that is about
      // to close — in which case it will fail the isConnected test on the way
      // back and focus lands on the composer instead, which is the honest
      // fallback rather than a guess.
      const opener = document.activeElement;
      panelOpenerRef.current =
        opener instanceof HTMLElement && opener !== document.body ? opener : null;
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
    // Not when there's nothing to stick to. The empty state is taller than a
    // phone, so this fired on first paint and landed the visitor halfway down
    // the tl;dr with the headline scrolled off — the one screen the site gets
    // to make its case, skipped, and only on mobile.
    if (el && stick.current && messages.length) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // The composer sizes itself to its content. Measurement, not a CSS trick:
  // reset to auto first, because scrollHeight of an already-tall textarea
  // reports the height it currently has, so a field that grew for a long paste
  // would never shrink back when the paste was cleared.
  //
  // Runs on `input` rather than in onChange so the slash commands and the
  // suggested questions — which set the value straight through setInput — get
  // resized too, instead of leaving a one-line box holding six lines of text.
  //
  // The floor is Math.max rather than the raw scrollHeight, and the field
  // carries a min-height in CSS to back it. An empty textarea can report a
  // scrollHeight computed against no content at all — measured before the font
  // has swapped, or on the first paint of a hydrated field — and writing that
  // number back as an explicit height locks the composer to a box shorter than
  // its own placeholder. `auto` resolves against the min-height; offsetHeight
  // reads what that resolved to, so the measurement can never shrink the field
  // below the size CSS already guaranteed it.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, el.offsetHeight)}px`;
  }, [input]);

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
        errorCopy={{ rateLimited: RATE_LIMIT_STATE }}
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
      {idleReady && (
        <PrintSheet
          messages={messages}
          title={SITE_NAME}
          sourceUrl={SITE_URL}
          permalink={permalink}
          footer={DISCLAIMER}
        />
      )}
      {/* Announcements only. Visually nothing, and in three ways deliberately
          placed:

          outside the transcript, so the answer text is never itself inside a
          live region and never read twice;

          outside `.screen-only`, and this one was learned by measurement. When
          a sheet opens, Radix hides everything behind it from assistive tech by
          marking the dialog's siblings aria-hidden — except that the library
          doing the marking deliberately spares any subtree containing an
          [aria-live] element, so parking this paragraph inside the shell left
          THE ENTIRE PAGE reachable behind an open modal. `npm run a11y` caught
          it as "the sheet is a modal dialog: FAIL";

          and outside the print document, which is where it would otherwise have
          landed by symmetry — a status line is not part of the paper. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
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
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 text-[12px] md:px-4">
        {/* Tap target, not a glyph. The bare ☰ character rendered at the
            header's own size was an ~11px target — well under the 44px iOS asks
            for, and it read as thin besides. The strip is 44px tall now, so
            this finally fills it at spec instead of a shade under. Drawn as an
            SVG because the Unicode trigram renders inconsistently across
            platforms, hairline-thin on iOS in particular. */}
        <button
          ref={railTriggerRef}
          type="button"
          onClick={() => setRailOpen(true)}
          aria-label="Open navigation"
          data-js-control
          className="-ml-1.5 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-text-soft hover:text-accent lg:hidden"
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
        {/* Fills the strip for the same reason the hamburger beside it does —
            a 12px line of text is not a touch target. */}
        <Link
          href="/"
          className="-mx-2 flex h-full touch-manipulation items-center px-2 text-text no-underline hover:text-accent"
        >
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
            data-js-control
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
              // A native select is the one control that "works" before
              // hydration in the worst way: it opens, it takes a choice, and
              // the choice reaches nothing.
              disabled={!hydrated}
              className="min-h-[36px] disabled:cursor-progress disabled:border-line disabled:text-text-dim cursor-pointer border border-line-strong bg-raised px-1.5 py-0.5 text-[13px] text-text-soft outline-none focus:border-accent"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <span className="flex items-center gap-1.5">
            {/* The strip said "ready" from the first paint, which on a slow
                connection was the single most confident lie on the page — the
                one readout a visitor would check to find out why nothing was
                happening, agreeing that everything was fine. It now says what
                is true. */}
            <span
              aria-hidden="true"
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                !hydrated ? "bg-text-dim" : isBusy ? "bg-accent" : "bg-signal"
              }`}
            />
            {/* The word is normally sm-and-up, because on a phone the dot
                carries it and the header is tight. Not while the page is still
                arriving: a grey dot alone is not an explanation, and the phone
                is the device this whole pass is about. So it shows at every
                width until hydration and then collapses back to the settled
                design. */}
            {/* sr-only rather than hidden below sm: the dot beside it is
                decorative, so a screen reader at phone width was being told
                nothing at all about whether the page was working. The word is
                in the accessibility tree at every width; only its visibility
                changes. */}
            <span className={!hydrated ? "inline" : "sr-only sm:not-sr-only sm:inline"}>
              {!hydrated ? "loading" : isBusy ? "streaming" : "ready"}
            </span>
          </span>
        </div>
      </header>

      {/* ---- Body --------------------------------------------------------- */}
      <div className="flex min-h-0 flex-1">
        {/* Rail — desktop */}
        <nav className="hidden w-56 shrink-0 flex-col border-r border-line bg-panel p-4 text-[13px] lg:flex">
          <RailContent onOpenPanel={openPanel} />
        </nav>

        {/* Conversation */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          {/* Ambient backdrop (extends #14): under the empty state, back
              during idle, gone while a conversation is on screen. It sits
              behind the scroll area rather than inside it so it doesn't
              scroll with the transcript. */}
          <AmbientBackdrop visible={!hasMessages || idle} />
          <div
            ref={scrollRef}
            onScroll={onScroll}
            // py-6 rather than py-8, and py-4 again from md up.
            //
            // The comment that used to sit here said py-8 → py-6 had brought
            // the disclaimer above the fold at 1280×800. It had not, and the
            // claim survived because nobody measured it. Measured: this scroll
            // area is 655px tall at that size and the empty state was 744, so
            // the disclaimer's first line ended 24px BELOW the fold and the
            // paragraph entire was 65px below it. The one thing on the page
            // that has to be read without being looked for was the one thing
            // you had to scroll for.
            //
            // Four md-scoped trims close it, the chips being half of it on
            // their own (149px of chip rows down to 107): two-up chips, this
            // padding, gap-3 → gap-2 on the stack, and the TL;DR's row
            // spacing. 744 → 660 against a 655px fold, so the whole disclaimer
            // now sits 11px clear of it and the only thing still below the
            // line is 5px of this element's own bottom padding.
            className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-4"
          >
            {/* Idle dims the column rather than covering it. The conversation
                stays legible and every control stays live — this is a settle,
                not a screensaver. */}
            <div
              className={`mx-auto max-w-[68ch] transition-opacity duration-700 ${
                idle ? "opacity-90" : "opacity-100"
              }`}
            >
              {/* A replayed conversation says so, once, at the top of the
                  thing it is describing (#18). It must never be mistaken for
                  a live session, and the honest version of that is a line the
                  reader passes on the way in — not a badge in the chrome. */}
              {replayed && (
                <div className="mb-6 border-l-2 border-accent bg-raised px-3 py-2">
                  <p className="t-meta text-text-soft">{REPLAY_BANNER}</p>
                  <button
                    type="button"
                    onClick={reset}
                    data-js-control
                    className="t-label flex min-h-[44px] touch-manipulation items-center text-text-faint hover:text-accent"
                  >
                    start a fresh one
                  </button>
                </div>
              )}

              {!hasMessages && (
                // A flex column rather than space-y, because the reading order
                // is not the source order below sm — see the chips.
                <div className="flex flex-col gap-3 md:gap-2">
                  {/* 30ch, not 24. The measure is set in the h1's OWN ch, so
                      the bigger hero was wrapping to three lines inside a
                      column wide enough for two — and the line it bought
                      pushed the disclaimer off a 800px-tall desktop. At 30ch
                      the column itself is the constraint again. */}
                  <h1 className="t-hero order-1 max-w-[30ch] font-medium text-text">
                    {HERO}
                  </h1>
                  <p className="t-body order-2 text-text-soft">{HERO_SUB}</p>
                  {/* THE CHIPS COME BEFORE THE TL;DR ON A PHONE.
                      The tl;dr is the six-second scan and it wants to be first,
                      which is what it got — but it has grown to six rows since,
                      and on a 390×844 screen those six rows plus the hero fill
                      the viewport exactly. The chips were never on screen at
                      all: the one control that shows a visitor what this site
                      is for sat below the fold on the only device where the
                      fold is the whole page. Above sm both fit, and the
                      original scan order — positioning, facts, the question you
                      can ask — is restored. */}
                  {/* TWO-UP FROM md, and the reason is arithmetic rather than
                      taste. Wrapped inline, the four chips take three rows at
                      1280 — the first two share a row, the long fit question
                      takes one alone, the visa question takes a third — and
                      those two extra rows are most of what was pushing the
                      disclaimer off the screen. A grid puts the fit question
                      beside the visa question, costs one wrapped line inside
                      it, and buys back 42px. Below md they still wrap: at 390
                      a two-column grid would put four chips at 175px each and
                      every one of them would be three lines deep. */}
                  <div className="order-3 flex flex-wrap gap-2 sm:order-4 sm:pt-1 md:grid md:grid-cols-2 md:pt-0">
                    {SUGGESTED.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          stick.current = true;
                          submit(q);
                        }}
                        disabled={isBusy || !hydrated}
                        // py-2.5 keeps a chip over 44px on a phone, where it is
                        // a finger target. md:py-2 takes it to 39px, which is
                        // the height the model select in the header already
                        // uses on the same screens — a pointer does not need
                        // the thumb allowance, and four chips at the phone
                        // height cost the disclaimer eight more pixels.
                        className="border border-line-strong px-3 py-2.5 text-left text-[14px] text-text-soft transition-colors hover:border-accent hover:text-text disabled:border-line disabled:text-text-dim md:py-2"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  {/* #25 — the six-second scan. See the note in
                      recruiter-tldr.tsx for why it is empty-state only. */}
                  <div className="order-4 sm:order-3">
                    <RecruiterTldr />
                  </div>
                  <p className="t-meta order-5 max-w-[58ch] text-text-faint">
                    {DISCLAIMER}
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {messages.map((m, mi) => {
                  const text = textOf(m);
                  const outs = toolOutputs(m);
                  if (!text && !outs.length) return null;
                  // Exchange number for the ledger rule — the count of user
                  // turns up to and including this message.
                  const exchange = messages
                    .slice(0, mi + 1)
                    .filter((x) => x.role === "user").length;
                  return (
                    // A turn resolves in rather than appearing: opacity plus a
                    // 4px blur clearing over 400ms. Ported from beautiful-ui's
                    // `stream-in`, and the one place its instinct beat ours —
                    // messages used to pop into a static column, which on a
                    // fast turn reads as a layout jump rather than an arrival.
                    //
                    // Mount-only by construction: a CSS animation restarts when
                    // the animation property changes, not when React re-renders,
                    // so the streaming turn is not re-blurred on every token.
                    <div key={m.id} className="animate-stream-in space-y-2">
                      {m.role === "user" ? (
                        // A ledger entry, not a chat bubble: full width, a
                        // numbered mono rule on top, no floating-right box.
                        // The right-aligned bubble is the single strongest
                        // "this is a ChatGPT clone" signal, and this site is
                        // an instrument log, not a messaging app.
                        <div className={mi > 0 ? "border-t border-line pt-4" : ""}>
                          <p className="mb-2 text-[12px] tracking-widest text-text-faint [font-family:var(--font-geist-mono)]">
                            {String(exchange).padStart(2, "0")} · you
                          </p>
                          <p className="t-body whitespace-pre-wrap border-l-2 border-accent pl-3 text-text">
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
                                    className={`border px-3 py-2.5 text-[13px] no-underline transition-colors hover:border-accent hover:text-accent ${
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
                                // Borderless, but it shares a row with the
                                // chips and has to be the same height to be
                                // aimed at alongside them.
                                className="flex touch-manipulation items-center px-1 py-2.5"
                              />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                {/* One line, and it names the step rather than the wait. The
                    key restarts the entry when the step changes, so a turn that
                    moves from extracting to judging looks like it moved — a
                    string swapping under a continuous animation reads as a
                    glitch. The elapsed count is NOT keyed, so it measures the
                    whole turn rather than restarting at each step. */}
                {phase && (
                  <div className="flex items-center gap-3">
                    <PhaseLine key={phase} phase={phase} elapsed={elapsed} />
                    {/* A way out of a turn that is taking too long, and only
                        then: offering "stop" against a two-second answer is
                        noise, and the reader has nothing to decide yet. Eight
                        seconds is roughly double a normal turn's wait, so it
                        appears when the wait has become a question. Quiet by
                        construction — same faint-until-hover vocabulary as the
                        actions strip, no border, no box. */}
                    {stallable && (
                      <button
                        type="button"
                        onClick={stop}
                        data-js-control
                        className="shrink-0 text-[13px] text-text-faint transition-colors hover:text-accent"
                      >
                        stop
                      </button>
                    )}
                  </div>
                )}
                {/* Was one grey sentence for every way a turn can fail. The
                    class has always been measured; this is the first thing to
                    render it, and to offer the turn back. */}
                {errorKind === "error" && (
                  <TurnError errorClass={errorClass} onRetry={retry} />
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
                    data-js-control
                    className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-raised md:px-10"
                  >
                    <span className="text-accent">{c.name}</span>
                    <span className="text-text-faint">{c.hint}</span>
                  </button>
                ))}
              </div>
            )}
            <form
              // Was a fixed h-12 row around a single-line input. The composer
              // grows now, so the height is a floor rather than a size, and the
              // prompt and the hints align to the FIRST line instead of the
              // centre — on a ten-line pasted job description, a vertically
              // centred ">" sits in the middle of the paste with nothing to do
              // with it.
              className="flex min-h-12 items-start px-4 text-[15px] md:px-10"
              onSubmit={(e) => {
                e.preventDefault();
                trySend();
              }}
            >
              <span className="py-3 text-[15px] leading-[1.6] text-accent">&gt;</span>
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // Enter still sends — this is a chat composer, not an
                  // editor. Shift+Enter is the newline, which is what makes a
                  // multi-line question writable at all.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    trySend();
                  }
                  if (e.key === "Escape") setInput("");
                }}
                id="ask"
                // Disabled rather than dimmed, and the attribute is doing two
                // jobs. It is the honest state — an unfocusable field cannot
                // take a question the page has no way to send — and it is half
                // of what makes the native submit below impossible, since a
                // disabled field cannot be typed into and so Enter cannot fire
                // an implicit submit.
                disabled={!hydrated}
                // Short enough to survive a 320px phone intact. The long
                // version — "Ask a question, or type / for commands" — was
                // clipped mid-word at every width a phone actually has, and the
                // half of it that got cut was the half doing the teaching. The
                // slash menu advertises itself the moment a "/" is typed.
                placeholder={hydrated ? "Ask a question" : "Loading the conversation…"}
                aria-label="Ask a question"
                enterKeyHint="send"
                // 16px below md is not a style choice: iOS Safari zooms the
                // viewport into any field it focuses whose font-size is under
                // 16px, and it does not zoom back out. The row's other text
                // stays 13px, so this only shows up on the phone — where the
                // input wanted the extra size anyway. The alternative fix,
                // maximum-scale=1 in the viewport, also kills pinch-zoom for
                // everyone; that is not a trade worth making.
                // The field carries the row's vertical padding rather than the
                // form doing it, so the full 48px of a one-line composer is
                // still a tap target — the reason the old input was h-full.
                // That trick doesn't survive auto-sizing, since a height set in
                // CSS is exactly what the measurement has to override.
                //
                // max-h caps the growth at eight lines and scrolls past that.
                // A pasted job description is the case this exists for, and one
                // of those can be sixty lines long; without a cap it eats the
                // conversation it was supposed to be asking about.
                className="ml-2 max-h-[216px] min-h-[48px] min-w-0 flex-1 resize-none bg-transparent py-3 text-[16px] leading-[1.6] text-text outline-none placeholder:text-text-faint disabled:cursor-progress disabled:placeholder:text-text-dim md:text-[15px]"
              />
              {/* One send control at every width.
                  It used to be two half-controls: an "enter ↵" hint on desktop
                  and a bare ↵ glyph below sm, so the widest screens had no
                  button at all and the narrowest had a 36px unlabelled one at
                  30% opacity when disabled — which reads as a rendering bug
                  rather than as a state. This is a real button: bordered,
                  labelled, 44px tall, and legible in both states.
                  my-1.5 centres it against the first line of a growing field
                  rather than against the whole composer. */}
              <button
                type="submit"
                // `!hydrated` first, and it is the whole point of this pass.
                // A submit button inside a <form> with no action is a live
                // control the moment the HTML lands: pressed before the
                // JavaScript arrives it fired a native GET submit, which
                // navigated the page to itself with the question in the query
                // string and threw away the load that was nearly finished. A
                // disabled submit cannot do that, and it cannot silently do
                // nothing either — it says so.
                disabled={!hydrated || !input.trim() || isBusy}
                className="-mr-1.5 my-1.5 ml-2 disabled:cursor-progress flex h-11 min-w-[44px] shrink-0 touch-manipulation items-center justify-center border border-line-strong bg-raised px-3 text-[14px] text-text-soft transition-colors hover:border-accent hover:text-accent disabled:border-line disabled:text-text-dim"
              >
                send ↵
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
              // The fade is the only thing that says this row scrolls. It has
              // no scrollbar on a phone, so a strip whose last action sat
              // exactly at the edge looked like a strip that ended there.
              style={{
                maskImage: "linear-gradient(to right, black 85%, transparent)",
                WebkitMaskImage: "linear-gradient(to right, black 85%, transparent)",
              }}
              // Before the first turn the strip holds only the job-description
              // entry, which is desktop-only — an empty 44px band under the
              // composer on a phone earns nothing, so it goes entirely.
              className={`h-11 items-center gap-4 overflow-x-auto whitespace-nowrap border-t px-4 text-[13px] transition-colors md:px-10 ${
                hasMessages ? "flex" : "hidden md:flex"
              } ${emphasis ? "border-accent" : "border-line"}`}
            >
              {hasMessages && (
                <>
                  <CopyButton
                    getText={conversationMarkdown}
                    label="copy"
                    copiedLabel="copied"
                    event="chat_copy_conversation"
                    // focus-inset for the same reason the strip's other
                    // buttons carry it: this row scrolls horizontally, and a
                    // ring drawn outside the control is clipped at either end.
                    className={`focus-inset flex h-full shrink-0 touch-manipulation items-center ${
                      emphasis ? "text-text-soft" : ""
                    }`}
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
                // Strip-worthy on desktop, where the strip is idle real estate;
                // on a phone it was the only thing under the composer and not
                // worth that space. The rail item is the mobile way in.
                className="hidden md:flex"
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
            {/* A splitter, and until now a pointer-only one: it announced
                itself as a separator and then offered a keyboard no way to
                move it. Arrows nudge, shift-arrows jump, Home and End go to the
                stops, Enter restores the default — the same set the double
                click already had. aria-valuenow makes the width audible rather
                than something to discover by listening to the layout. */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panel"
              aria-valuenow={Math.round(panelWidth)}
              aria-valuemin={PANEL_MIN}
              aria-valuemax={PANEL_MAX}
              tabIndex={0}
              onPointerDown={() => {
                dragging.current = true;
                document.body.style.userSelect = "none";
              }}
              onDoubleClick={() => setPanelWidth(PANEL_DEFAULT)}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 64 : 16;
                let next: number | null = null;
                if (e.key === "ArrowLeft") next = panelWidth + step;
                else if (e.key === "ArrowRight") next = panelWidth - step;
                else if (e.key === "Home") next = PANEL_MAX;
                else if (e.key === "End") next = PANEL_MIN;
                else if (e.key === "Enter") next = PANEL_DEFAULT;
                if (next == null) return;
                e.preventDefault();
                const clamped = Math.min(PANEL_MAX, Math.max(PANEL_MIN, next));
                setPanelWidth(clamped);
                try {
                  window.localStorage.setItem(PANEL_WIDTH_KEY, String(clamped));
                } catch {
                  /* persistence is a nicety */
                }
              }}
              className="hidden w-1 shrink-0 cursor-col-resize bg-line transition-colors hover:bg-accent focus-visible:bg-accent lg:block"
            />
            {/* Named, so it is a landmark a screen reader can jump to and
                identify rather than an unlabelled complementary region — and
                named with the same string its own header shows. */}
            <aside
              aria-label={panelTitle(panel)}
              style={{ width: panelWidth }}
              className="hidden shrink-0 flex-col border-l border-line bg-panel lg:flex"
            >
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-4 text-[13px]">
                <span className="truncate text-text-faint">{panelTitle(panel)}</span>
                <button
                  type="button"
                  onClick={closePanel}
                  className="-mr-2 flex h-full shrink-0 items-center px-2 text-text-faint hover:text-accent"
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

      {/* ---- Mobile sheets ------------------------------------------------
          Loaded on demand. Radix's dialog — portal, overlay, focus trap,
          scroll lock — is a real chunk of JavaScript, and below lg it is the
          only thing that uses it. `isMobile` is false until an effect measures
          the viewport, so on a desktop the module is never fetched at all, and
          on a phone it is fetched after hydration rather than before it. */}
      {isMobile && (idleReady || railOpen || panelOpen) && (
        <MobileSheets
          onRailClosed={() => railTriggerRef.current?.focus()}
          onPanelClosed={() => {
            const opener = panelOpenerRef.current;
            if (opener?.isConnected && opener.offsetParent !== null) opener.focus();
            else inputRef.current?.focus();
          }}
          railOpen={railOpen}
          onRailOpenChange={setRailOpen}
          rail={<RailContent onOpenPanel={openPanel} showHeading={false} />}
          readouts={{
            turns: `${turns}/10`,
            ttft: ttft == null ? "—" : `${ttft}ms`,
            cost: formatUsd(sessionCost.total),
            model,
          }}
          panelOpen={panelOpen}
          panelTitle={panelTitle(panel)}
          panelContent={panelContent}
          sheetOpen={sheetOpen}
          onSheetOpen={() => setSheetOpen(true)}
          onClosePanel={closePanel}
          sheetFull={sheetFull}
          onToggleFull={() => setSheetFull((v) => !v)}
        />
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
            className="-mx-1 flex min-h-[44px] touch-manipulation items-center px-1 text-[13px] text-text-faint no-underline hover:text-accent"
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
  // A rail item is a row of text, and a row of text is not a target. min-h
  // plus items-center makes each one a full 44px band without changing what it
  // looks like — the border sits where the padding already put it.
  const cls =
    "flex min-h-[44px] items-center border-b border-line py-2 text-left text-text-soft no-underline transition-colors hover:text-accent";

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
      <button
        type="button"
        onClick={() => onOpenPanel(item.view as PanelView)}
        data-js-control
        className={cls}
      >
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
  className = "flex",
}: {
  label: string;
  emphasis: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-js-control
      // Full-height rather than text-height. The label is a single line, so
      // the hit area used to be a 17px band inside a 32px strip — fine with a
      // cursor, a coin toss with a thumb. The strip is 44px now.
      className={`${className} focus-inset h-full shrink-0 touch-manipulation items-center transition-colors hover:text-accent ${
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

// The idle one-liner arrives settled — a fade, not a typewriter. It used to
// type itself out character by character, which put a second motion on screen
// against the ambient wave; the §4 policy allows one, and the wave is it. The
// caret stays as punctuation, no longer pulsing. Deliberately the quietest
// thing on the page: it sits below the conversation, never above it.
function IdleLine({ line }: { line: string }) {
  return (
    <p className="t-meta animate-idle-line pt-6 text-text-faint">
      {line}
      <span className="text-accent">▍</span>
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
      // Same padding as the source chips in answer.tsx — they sit in adjacent
      // rows under the same answer and were two different sizes.
      className={`border px-3 py-2.5 text-[13px] transition-colors hover:border-accent hover:text-accent ${
        latest ? "border-line-strong text-text-soft" : "border-line text-text-faint"
      }`}
    >
      ↗ {label}
    </button>
  );
}
