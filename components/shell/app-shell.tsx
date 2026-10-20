"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  HEADER_NAV,
  IDLE_LINES,
  JD_COPY,
  RAIL_CONTACT_LABEL,
  RAIL_HOW,
  RAIL_WORK,
  SLASH_COMMANDS,
  SLUG_TO_RESUME,
  SOCIAL_LINKS,
  type RailGroup,
  type RailItem,
} from "./shell-data";
import { Answer } from "./answer";
import { usePanelUrl } from "./use-panel-url";
import { panelTitle } from "./panel-title";
import { CopyButton } from "./copy-button";
import { useTokenRate } from "./use-token-rate";
import { useTeletype } from "./use-teletype";
import { useHydrated } from "./use-hydrated";
import { useIdleReady } from "./use-idle-ready";
import { useIdle } from "./use-idle";
import { useElapsed } from "./use-elapsed";
import { PhaseLine } from "./phase-line";
import { AmbientBackdrop } from "./ambient-backdrop";
import { TurnError } from "./turn-error";
import { conversationToMarkdown, latestRoleFit, messageToMarkdown } from "@/lib/transcript";
import { isJdPrefix } from "@/lib/job-posting";
import { permalinkFor } from "@/lib/permalink";
import {
  DISCLAIMER,
  downloadAs,
  RESUME_PDF,
  HEADSHOT,
  RESUME_PDF_FILENAME,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import { track } from "@/lib/analytics";
import { CaseCards, RecruiterTldr } from "./recruiter-tldr";
import {
  POSITIONING,
  ROLE_LINE,
  SUGGESTED_QUESTIONS as SUGGESTED,
} from "@/content/recruiter";
import { EmailCopy, LinkedInButton, ResumePdfButton } from "@/components/contact-actions";
import { costOfTurn, sumCosts } from "@/lib/pricing";
import { MAX_USER_MESSAGES, MODEL_IDS } from "@/lib/models";
import { isShellPanel, type ShellPanelKind } from "./panels";
import { receiptText, type ReadoutState } from "./readouts";
import {
  pushChatEntry,
  pushHomeEntry,
  useConversationHistory,
} from "./conversation-history";
import {
  textOf,
  toolOutputs,
  useConversation,
  type PanelView,
  type RoleFit,
  type ToolOut,
} from "./use-conversation";

// ---------------------------------------------------------------------------
// Loaded on demand
// ---------------------------------------------------------------------------
// The homepage's first load on a throttled phone is bandwidth-bound, so
// anything a visitor can't reach without first doing something (opening a
// panel, failing a turn, raising a sheet) stays out of the entry chunk.
// `ssr: false` throughout: each one renders only behind client state, so
// pre-rendering would add markup nobody can see yet.
//
// Two deliberate exceptions, so nobody re-splits them by reflex:
//   answer.tsx      on the streaming path; a lazy chunk fetched as the first
//                   token lands is a visible stall.
//   recruiter-tldr  part of the empty state, which is the first screen.

// The panel's content and the heaviest module in the shell: three MDX case
// studies, the knowledge base, the repo corpus and the system-prompt builder.
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

// Radix's dialog. Mounted on the first sheet-opening tap or at idle, whichever
// comes first, so the chunk is warm before anyone reaches for it.
const MobileSheets = dynamic(
  () => import("./mobile-sheets").then((m) => m.MobileSheets),
  { ssr: false },
);

// The print document. Mounted at idle rather than on an interaction: nothing
// can reliably intercept Cmd-P, so it has to be in the DOM before the dialog
// opens, just not before the composer works. See use-idle-ready.ts.
const PrintSheet = dynamic(() => import("./print-sheet").then((m) => m.PrintSheet), {
  ssr: false,
});

// ---------------------------------------------------------------------------
// Copy. Final strings come from docs/site-copy.md; drafted ones are logged in
// docs/copy-ledger.md.
// ---------------------------------------------------------------------------
const HERO = "I learn what the problem needs, then I build the thing.";
// The empty state's desktop placeholder. The subline under the headline is
// POSITIONING from content/recruiter.ts, where the citation checker covers it.
const HERO_SUB = "Ask what you'd ask on a call";
// The composer's fine print, one line at each width. The full DISCLAIMER in
// lib/site.ts travels with exports.
const DISCLAIMER_SHORT = "AI answers can be wrong.";
const DISCLAIMER_LONG =
  "Answers cite their sources but can be wrong. The resume is the authoritative version.";
// Per-class error copy lives in lib/chat-telemetry.ts, rendered by TurnError.
const RATE_LIMIT_STATE =
  "You've hit the message limit for now. The resume has everything in the meantime.";
// Says three things, all checkable in this repo: this is a replay, it was
// rebuilt from the link rather than fetched from a server, and it stopped
// being live when it was made.
const REPLAY_BANNER =
  "Replayed conversation, rebuilt from the link you opened. The site stored nothing. This is a snapshot of what the model said at the time, not a live session.";
// A fit check is sent to people who have never seen the site
// (docs/application-links.md), so a replayed one says what it is first. Both
// claims are enforced by lib/role-fit.ts: a match without a source is
// downgraded, and gaps can't be empty while a row is unmet.
const REPLAY_FIT_LINE =
  "A fit check: the assistant on Sidhant Mathur's site read one job posting against his record, citing a source for every match and listing the gaps.";
// Only when the posting really was left out, as it is in every link
// lib/transcript.ts (toSnapshot) builds now; older links carry it.
const REPLAY_POSTING_LEFT_OUT =
  "The link leaves out the posting. Each requirement in the table is quoted from it.";
// The way out of a conversation, and the way back into one. A conversation
// left by Home, a reload or the browser's Back is kept, and the front door
// offers it here.
const HOME_LABEL = "Home";
const CONVERSATION_LABEL = "Your conversation";
const REPLAY_LABEL = "Shared conversation";
// Short enough to fit beside "clear" on a 375px phone without truncating.
const CONTINUE_LABEL = "Continue where you left off";
const CONTINUE_HINT = "or ask something new to start over";
const CLEAR_LABEL = "clear";
const questionCount = (n: number) => `${n} ${n === 1 ? "question" : "questions"}`;
// Said when the per-conversation cap is reached, so it isn't mistaken for the
// hourly budget (ManualMode), which is a wait. This one is fixed by a tap.
const CONVERSATION_FULL = `That's ${MAX_USER_MESSAGES} questions, the most one conversation holds. Start a new one to keep asking — this one stays saved on the front page.`;
const CONVERSATION_FULL_ACTION = "Start a new conversation";
const CONVERSATION_FULL_PLACEHOLDER = "This conversation is full";

// How long a turn runs before the shell offers to abandon it. Roughly double a
// normal answer's wait — early enough to be a rescue, late enough not to be a
// suggestion that something is wrong.
const STALL_HINT_SECONDS = 8;

const PANEL_WIDTH_KEY = "panel.width.v1";
const PANEL_MIN = 300;
const PANEL_MAX = 640;
const PANEL_DEFAULT = 380;

export function AppShell() {
  // Every control that needs JavaScript is gated on this; see use-hydrated.ts.
  const hydrated = useHydrated();
  // The print document and the sheets must exist before they're asked for, but
  // not delay the composer. See use-idle-ready.ts.
  const idleReady = useIdleReady();
  const [model, setModel] = useState<string>(MODEL_IDS[0]);

  const {
    messages,
    submit,
    retry,
    stop,
    leave,
    resume,
    clearSaved,
    saved,
    full,
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

  // What the replay banner says. Read off the decoded conversation rather than
  // the link, so it's true of whatever arrived.
  const replayedFit = replayed && latestRoleFit(messages) != null;
  const postingLeftOut =
    replayedFit && messages.some((m) => m.role === "user" && isJdPrefix(textOf(m)));

  // ---- Instruments ---------------------------------------------------------
  //
  // Both read the same string, the text of the streaming answer: the rate
  // meter samples how fast it grows and the teletype ticks when it does.
  // Nothing here can change what the model does or what the reader has to do;
  // see the note at the top of instruments.tsx.
  const lastMessage = messages[messages.length - 1];
  const streamingText = lastMessage?.role === "assistant" ? textOf(lastMessage) : "";
  const rate = useTokenRate(streamingText, isBusy);
  const { teletype, toggleTeletype } = useTeletype(streamingText, isBusy);
  // Unlike the two above, this survives the turn ending, because the finished
  // duration is the interesting number.
  const elapsed = useElapsed(isBusy);
  // Past this, the wait has become a question and the reader gets a way out
  // (the stop button beside the phase line).
  const stallable = isBusy && elapsed != null && elapsed >= STALL_HINT_SECONDS;
  const sessionCost = useMemo(
    () => sumCosts(turnLog.map((t) => (t.error ? null : costOfTurn(t.model, t.usage)))),
    [turnLog],
  );
  // The four session numbers for the index sheet; see readouts.ts.
  const readouts: ReadoutState = { turns, ttft, cost: sessionCost.total, model };
  // What the last answer cost: the newest turn that finished and was priced.
  // A failed turn is skipped rather than reported as free.
  const lastAnswerCost = useMemo(() => {
    for (let i = turnLog.length - 1; i >= 0; i -= 1) {
      const t = turnLog[i]!;
      if (t.error || t.usage == null) continue;
      return costOfTurn(t.model, t.usage)?.total ?? null;
    }
    return null;
  }, [turnLog]);

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
  // Streamed prose can't go in a live region (a screen reader would read the
  // answer over itself for the length of the turn), so each completed turn
  // gets one polite announcement instead, and the answer is read once, when
  // the reader navigates to it. The turn number makes each announcement a
  // distinct string: a live region doesn't re-announce text identical to what
  // it already holds.
  //
  // Failures don't come through here. TurnError carries role="alert", which
  // interrupts rather than waits, as a turn that didn't happen should.
  const [announcement, setAnnouncement] = useState("");
  // Counted rather than edge-triggered: on a fast turn the whole answer can
  // arrive inside one render batch, leaving no true→false `isBusy` transition
  // to observe. Whenever the shell is idle with one more finished answer than
  // was last announced, that is the event. The mocked-stream check in
  // scripts/a11y-audit.mjs covers the fast case.
  const announcedCount = useRef(0);
  useEffect(() => {
    if (isBusy) return;
    const answered = messages.filter((m) => m.role === "assistant" && textOf(m)).length;
    // Fewer than before means the conversation was left or swapped, which is
    // not an answer and must not leave the counter high enough to swallow the
    // next one.
    if (answered <= announcedCount.current) {
      announcedCount.current = answered;
      return;
    }
    announcedCount.current = answered;
    // The error and rate-limit blocks announce themselves; an aborted turn was
    // the reader's own doing and renders nothing on purpose. errorKind is a
    // string union, so this has to compare with "none": a truthiness test
    // passes even when nothing has gone wrong.
    if (errorKind !== "none") return;
    queueMicrotask(() => setAnnouncement(`Answer ${answered} complete.`));
  }, [isBusy, errorKind, messages]);

  const [input, setInput] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  // ---- Where focus goes when a sheet closes --------------------------------
  //
  // The dialog primitive doesn't hand focus back to whatever opened it (closing
  // the rail sheet dropped focus on <body>), so the shell restores it itself.
  const railTriggerRef = useRef<HTMLButtonElement>(null);
  const panelOpenerRef = useRef<HTMLElement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFull, setSheetFull] = useState(false);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const [linkCopied, setLinkCopied] = useState(false);

  // ---- Export and the actions strip ----------------------------------------
  //
  // The link is held here rather than in the export panel because the print
  // document carries it too. A permalink describes the turns it was built
  // from, so it's remembered with that turn count and stops being current the
  // moment another turn lands. Derived rather than cleared in an effect, so
  // there's no window where the panel shows a link to a shorter conversation.
  const [builtLink, setBuiltLink] = useState<{ link: string; at: number } | null>(null);
  const permalink = builtLink && builtLink.at === messages.length ? builtLink.link : null;
  const setPermalink = useCallback(
    (link: string | null) => setBuiltLink(link ? { link, at: messages.length } : null),
    [messages.length],
  );

  // After an action, the always-present strip gains a little weight for a few
  // seconds. Nothing new appears, and nothing has to guess when a visit ends.
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

  // Below lg the panel is a bottom sheet instead of the resizable aside.
  // Starts false so the first client render matches the server; both sheets
  // are closed at mount, so there's nothing to flash.
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
      // Whatever had focus when the panel was asked for, read before any state
      // changes. If it's inside a sheet that's about to close, it fails the
      // isConnected check on the way back and focus lands on the composer.
      const opener = document.activeElement;
      panelOpenerRef.current =
        opener instanceof HTMLElement && opener !== document.body ? opener : null;
      // Opening a citation counts as an action too: someone checking a source
      // is taking this seriously.
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
    // Not when there's nothing to stick to: the empty state is taller than a
    // phone, and pinning it would land the visitor halfway down with the
    // headline scrolled off. Not onto a replay either: it's a page someone was
    // sent, so it opens at the top with its banner and contact actions in
    // view. Sticking resumes with the reader's first new message.
    const replaying = replayed && messages[messages.length - 1]?.id.startsWith("replay-");
    if (el && stick.current && messages.length && !replaying) el.scrollTop = el.scrollHeight;
  }, [messages, replayed]);

  // The composer sizes itself to its content. Reset to auto first, because an
  // already-tall textarea reports its current height as scrollHeight and would
  // never shrink back after a paste is cleared. Runs on `input` rather than in
  // onChange so values set through setInput (slash commands, suggested
  // questions) get resized too.
  //
  // Math.max with offsetHeight, backed by a CSS min-height: an empty textarea
  // can report a scrollHeight computed against no content (before the font
  // swaps, or on a hydrated field's first paint), and writing that back would
  // lock the composer shorter than its placeholder. `auto` resolves against
  // the min-height, so the measurement never shrinks the field below it.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, el.offsetHeight)}px`;
  }, [input]);

  // Every way of asking goes through here: the composer, the chips, a slash
  // command and the job-description panel. The first question from the front
  // door is where a conversation begins, so it gets its own history entry, and
  // Back from the conversation returns to the front door instead of leaving
  // the site.
  function ask(text: string) {
    if (!messages.length) pushChatEntry();
    stick.current = true;
    submit(text);
  }

  // The front door, from anywhere: the name, Home, the replay banner, the
  // conversation-full notice and the browser's Back all land here. Nothing is
  // lost on the way; see `leave` in use-conversation.ts.
  const showFrontDoor = useCallback(() => {
    leave();
    setSheetOpen(false);
    setRailOpen(false);
    // After the front door has rendered into the same scroll area, which was
    // scrolled to the foot of the conversation.
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
  }, [leave]);

  function goHome() {
    if (messages.length) pushHomeEntry();
    showFrontDoor();
  }

  // Back into the saved conversation at its latest answer, as it was left.
  const resumeAtEnd = useCallback(() => {
    stick.current = true;
    resume();
  }, [resume]);

  function continueSaved() {
    pushChatEntry();
    resumeAtEnd();
  }

  useConversationHistory({
    inConversation: messages.length > 0,
    canResume: saved != null,
    leave: showFrontDoor,
    resume: resumeAtEnd,
  });

  const submitJd = (text: string) => {
    ask(`${JD_COPY.prefix}\n\n${text}`);
    setSheetOpen(false);
    setPanel({ kind: "none" });
  };

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
    if (cmd.kind === "panel" && cmd.panel) return openPanel({ kind: cmd.panel });
    if (cmd.message) ask(cmd.message);
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
    if (isBusy || full) return;
    ask(q);
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

  // What the instruments' citation trace checks: every answer that has
  // finished arriving. The streaming one is left out — its last sentence is
  // half a sentence, and checking it would flash verdicts that change a token
  // later.
  const settledAnswers = useMemo(
    () =>
      messages
        .filter((m) => m.role === "assistant" && (!isBusy || m.id !== lastId))
        .map((m) => textOf(m))
        .filter(Boolean),
    [messages, isBusy, lastId],
  );

  // The suggested-question chips, built once and rendered in two places by
  // width: in the dock above the composer from md up, grouped with the
  // interview they start, and in the hero column below md, after the facts,
  // where a phone's fold belongs to the headline and the actions.
  const chipButtons = SUGGESTED.map((q) => (
    <button
      key={q}
      type="button"
      onClick={() => ask(q)}
      disabled={isBusy || !hydrated}
      // py-2.5 keeps a chip over 44px on a phone, where it is a finger
      // target; md:py-2 matches the header's pointer-sized controls.
      className="border border-line-strong px-3 py-2.5 text-left t-meta text-text-soft transition-colors hover:border-accent hover:text-text disabled:border-line disabled:text-text-dim md:py-2"
    >
      {q}
    </button>
  ));

  // Two panel views aren't built from content (export is conversation state,
  // the deck is instrument state), so they render here rather than inside
  // PanelBody, which would otherwise need every instrument threaded through
  // it. The registry in panels.ts says which ones; keyed by ShellPanelKind,
  // this record can't miss one. Thunks, so only the selected body is built.
  const shellPanel: Record<ShellPanelKind, () => React.ReactNode> = {
    export: () => (
      <ExportDeck
        messages={messages}
        permalink={permalink}
        onPermalink={setPermalink}
        onPrint={() => window.print()}
        onAction={bumpStrip}
      />
    ),
    instruments: () => (
      <InstrumentDeck
        turnLog={turnLog}
        budget={budget}
        model={model}
        onModelChange={setModel}
        hydrated={hydrated}
        rate={rate}
        teletype={teletype}
        onToggleTeletype={toggleTeletype}
        errorCopy={{ rateLimited: RATE_LIMIT_STATE }}
        answers={settledAnswers}
      />
    ),
  };

  const panelContent = isShellPanel(panel.kind) ? (
    shellPanel[panel.kind]()
  ) : (
    <PanelBody panel={panel} onSubmitJd={submitJd} onOpenSource={openPanel} />
  );

  return (
    <>
      {/* ---- Print document --------------------------------------------
          A sibling of the shell, not a child: print hides the shell subtree,
          so a nested document would print blank. From idle onwards it's in
          the DOM, display:none until print (app/globals.css), so Cmd-P, which
          nothing can reliably intercept, prints the document, not the app. */}
      {idleReady && (
        <PrintSheet messages={messages} permalink={permalink} />
      )}
      {/* Announcements only, deliberately outside three things: the
          transcript, so answer text is never inside a live region; the
          `.screen-only` shell, because Radix's aria-hidden marking spares any
          subtree containing an [aria-live] element, so inside the shell it
          left the whole page reachable behind an open sheet (`npm run a11y`
          checks this); and the print document, which a status line isn't
          part of. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="screen-only flex h-dvh flex-col bg-bg text-text [font-family:var(--font-geist-mono)]">
      {/* Skip link past the header and the front door's actions to the
          question box. Visually hidden until focused. */}
      <a
        href="#ask"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:border focus:border-accent focus:bg-panel focus:px-3 focus:py-1.5 focus:text-[14px] focus:text-text focus:no-underline"
      >
        Skip to the question box
      </a>

      {/* ---- Status strip ------------------------------------------------- */}
      <header className="t-meta flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 md:h-16 md:px-4">
        {/* The one way into the full index, at every width. A full 44px
            target, drawn as an SVG because the Unicode trigram renders
            inconsistently across platforms and hairline-thin on iOS. */}
        <button
          ref={railTriggerRef}
          type="button"
          onClick={() => setRailOpen(true)}
          aria-label="Open the index"
          // `disabled` as well as the CSS gate: `pointer-events: none` stops a
          // tap but leaves the button in the tab order, where Enter before
          // hydration would silently do nothing.
          disabled={!hydrated}
          data-js-control
          className="-ml-1.5 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center text-text-soft hover:text-accent"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
          </svg>
        </button>
        {/* Fills the strip for the same reason the index button does: a line
            of text isn't a touch target.
            The name is the way home, and on this route a link to "/" is a
            link to where the visitor already is, so it did nothing from
            inside a conversation. A plain click goes to the front door;
            a modified one still opens the site in a new tab. */}
        <Link
          href="/"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            goHome();
          }}
          className="-mx-2 flex h-full touch-manipulation items-center px-2 text-text no-underline hover:text-accent"
        >
          {SITE_NAME}
        </Link>
        <span className="hidden text-text-faint lg:inline">Toronto, ON</span>

        <div className="ml-auto flex items-center gap-2 text-text-faint sm:gap-4">
          {/* The nav stays at every width, conversation or not, so the resume
              and contact links are there once a visitor shows interest. A
              phone drops Projects below 440px, where the index still carries
              it — the name and three links at the meta size don't fit beside
              the index button on a 390px screen. Live readouts belong to the instruments panel; the header
              keeps only the receipt below. */}
          <nav aria-label="Site" className="flex items-center text-text-soft">
            {HEADER_NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className={`h-11 touch-manipulation items-center px-1.5 no-underline transition-colors hover:text-accent sm:px-3 ${
                  n.label === "Projects" ? "hidden min-[440px]:flex" : "flex"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => openPanel({ kind: "contact" })}
              disabled={!hydrated}
              data-js-control
              className="flex h-11 touch-manipulation items-center px-1.5 transition-colors hover:text-accent sm:px-3"
            >
              Contact
            </button>
          </nav>
          {/* The receipt: turns used and what the last answer cost, and the
              way into everything else. lg and up, where it fits beside the
              nav; below that the ☰ index carries the same numbers and the
              Instruments entry. */}
          {hasMessages && (
            <button
              type="button"
              onClick={() => openPanel({ kind: "instruments" })}
              title="Open the technical details"
              disabled={!hydrated}
              data-js-control
              className="hidden h-11 items-center tabular-nums transition-colors hover:text-accent lg:flex"
            >
              {receiptText(turns, lastAnswerCost)}
            </button>
          )}
          <span className="flex items-center gap-1.5">
            {/* Grey while the page is still loading, so it never says "ready"
                before it is. */}
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-full ${
                !hydrated ? "bg-text-dim" : isBusy ? "bg-accent" : "bg-signal"
              }`}
            />
            {/* Visible at every width until hydration, because a grey dot alone
                explains nothing; after that, visible from sm up. Below sm it's
                sr-only rather than hidden, since the dot is decorative and a
                screen reader still needs the state. */}
            <span className={!hydrated ? "inline" : "sr-only sm:not-sr-only sm:inline"}>
              {!hydrated ? "loading" : isBusy ? "streaming" : "ready"}
            </span>
          </span>
        </div>
      </header>

      {/* ---- Body --------------------------------------------------------- */}
      <div className="flex min-h-0 flex-1">
        {/* Conversation. */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* Under the empty state, back during idle, gone while a
              conversation is on screen. Behind the scroll area rather than
              inside it, so it doesn't scroll with the transcript. */}
          <AmbientBackdrop visible={!hasMessages || idle} />
          {/* ---- Conversation bar ---------------------------------------
              A conversation is a place, so it gets a title bar like the
              context panel's, at the same height, with the way out where a
              visitor looks for one: top left, labelled, bordered so it reads
              as a button. The count makes the cap visible before it is hit. */}
          {hasMessages && (
            <div className="relative z-10 flex h-11 shrink-0 items-center gap-3 border-b border-line bg-panel px-4 text-[13px] md:px-10">
              <button
                type="button"
                onClick={goHome}
                data-js-control
                className="group -ml-1 flex h-full shrink-0 touch-manipulation items-center px-1"
              >
                <span className="flex h-8 items-center gap-1.5 border border-line-strong bg-raised px-2.5 text-text-soft transition-colors group-hover:border-accent group-hover:text-accent">
                  <span aria-hidden="true">←</span>
                  {HOME_LABEL}
                </span>
              </button>
              {/* Below sm the count needs the room more than the label does. */}
              <span className="hidden min-w-0 truncate text-text-faint sm:inline">
                {replayed ? REPLAY_LABEL : CONVERSATION_LABEL}
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-text-faint">
                {turns} of {questionCount(MAX_USER_MESSAGES)}
              </span>
            </div>
          )}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            // Fold target, checked with `npm run shot`: headline, subline and
            // all three actions above the fold at 1280×800 and on a 390×844
            // phone. The tl;dr may break the fold.
            className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-5"
          >
            {/* Idle dims the column rather than covering it. The conversation
                stays legible and every control stays live — this is a settle,
                not a screensaver. */}
            <div
              className={`mx-auto max-w-[68ch] transition-opacity duration-700 ${
                idle ? "opacity-90" : "opacity-100"
              }`}
            >
              {/* A replay says so once, at the top, so it can't be mistaken for
                  a live session. It's also a standalone page sent to people
                  who have never seen the site, so it carries the same three
                  contact actions as the front door. */}
              {replayed && (
                <div className="mb-6 space-y-3 border-l-2 border-accent bg-raised px-3 py-3">
                  {replayedFit && (
                    <p className="t-body text-text [font-family:var(--font-geist-sans)]">
                      {REPLAY_FIT_LINE}
                    </p>
                  )}
                  <p className="t-meta text-text-soft">
                    {REPLAY_BANNER}
                    {postingLeftOut && ` ${REPLAY_POSTING_LEFT_OUT}`}
                  </p>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                    <ResumePdfButton surface="replay" primary={replayedFit} />
                    <EmailCopy surface="replay" />
                    <LinkedInButton surface="replay" />
                  </div>
                  <button
                    type="button"
                    onClick={goHome}
                    data-js-control
                    className="t-label flex min-h-[44px] touch-manipulation items-center text-text-faint hover:text-accent"
                  >
                    start a new conversation
                  </button>
                </div>
              )}

              {!hasMessages && (
                // The front door: who, what he wants, and three ways to act,
                // before any engagement and in source order at every width.
                // Prose reads in the sans face; everything actionable keeps
                // the mono register of the controls around it.
                <div className="flex flex-col gap-4">
                  {/* Name and role in the words a recruiter searches for. The
                      photo is small on purpose, a marker beside the name
                      rather than a portrait (see the headshot rule in
                      app/globals.css). */}
                  <div className="flex items-center gap-3">
                    <Image
                      src={HEADSHOT}
                      alt="Sidhant Mathur"
                      width={56}
                      height={56}
                      sizes="56px"
                      loading="eager"
                      className="headshot h-12 w-12 shrink-0 border border-line-strong object-cover md:h-14 md:w-14"
                    />
                    <p className="min-w-0 [font-family:var(--font-geist-sans)]">
                      <span className="block text-[16px] font-medium leading-snug text-text">
                        {SITE_NAME}
                      </span>
                      <span className="block text-[15px] leading-snug text-text-soft">
                        {ROLE_LINE.value}
                      </span>
                    </p>
                  </div>
                  <h1 className="t-hero max-w-[24ch] font-semibold text-text [font-family:var(--font-geist-sans)]">
                    {HERO}
                  </h1>
                  {/* Answers "what does he want" without a scroll. The string
                      lives in content/recruiter.ts under the same citation
                      check as the tl;dr rows — see POSITIONING. */}
                  <p className="t-body max-w-[52ch] text-text-soft [font-family:var(--font-geist-sans)]">
                    {POSITIONING.value}
                  </p>
                  {/* The resume PDF is primary: it's the file a recruiter
                      attaches to an ATS record. Which format visitors take is
                      still open, so both are tracked. The email is on screen
                      and copyable because a bare mailto: is a dead end without
                      a mail client. */}
                  <div className="flex flex-col gap-2.5 pt-2 sm:flex-row sm:flex-wrap">
                    <ResumePdfButton surface="front-door" primary />
                    <EmailCopy surface="front-door" />
                    <LinkedInButton surface="front-door" />
                  </div>
                  {/* "Interview this site" only focuses the composer, so it's
                      styled as a link, and gated on hydration like every
                      control that needs JavaScript. */}
                  <div className="-mt-1.5 flex flex-wrap items-center gap-x-5 t-meta">
                    <Link
                      href="/resume"
                      onClick={() => track("resume_open", { surface: "front-door" })}
                      className="flex min-h-[44px] touch-manipulation items-center text-text-soft underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                    >
                      Resume as a web page
                    </Link>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.focus()}
                      disabled={!hydrated}
                      data-js-control
                      className="flex min-h-[44px] touch-manipulation items-center text-text-soft underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent disabled:text-text-dim disabled:no-underline"
                    >
                      Ask the AI assistant ↓
                    </button>
                  </div>
                  {/* The six-second scan; see recruiter-tldr.tsx. */}
                  <div>
                    <RecruiterTldr />
                  </div>
                  {/* Two case studies, one number each. */}
                  <CaseCards />
                  {/* Below md the chips live here, after the facts; from md
                      up they sit in the dock, grouped with the composer they
                      feed. See chipButtons above. */}
                  <div className="flex flex-wrap gap-2 pt-1 md:hidden">{chipButtons}</div>
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
                    // A turn resolves in (opacity plus a 4px blur clearing over
                    // 400ms) rather than popping into the column. A CSS
                    // animation restarts only when the animation property
                    // changes, not on re-render, so the streaming turn isn't
                    // re-blurred on every token.
                    <div key={m.id} className="animate-stream-in space-y-2">
                      {m.role === "user" ? (
                        // A ledger entry, not a chat bubble: full width with a
                        // numbered mono rule on top. A replayed turn isn't the
                        // reader's own question, so it says "asked", not "you".
                        <div className={mi > 0 ? "border-t border-line pt-4" : ""}>
                          <p className="mb-2 t-label tracking-widest text-text-faint [font-family:var(--font-geist-mono)]">
                            {String(exchange).padStart(2, "0")} ·{" "}
                            {m.id.startsWith("replay-") ? "asked" : "you"}
                          </p>
                          <p className="t-body whitespace-pre-wrap border-l-2 border-accent pl-3 text-text">
                            {text}
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* The answer owns its own sources: markers out of
                              the prose, into the margin, and a source row
                              under it once the turn settles. */}
                          <Answer
                            text={text}
                            settled={!isBusy || m.id !== lastId}
                            onOpenSource={openPanel}
                          />
                          {/* Tool citations and the copy button share one row.
                              The copy button is always visible, not revealed
                              on hover, because touch has no hover. */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {outs.map((o, i) => (
                              <Fragment key={i}>
                                <CitationChip
                                  out={o}
                                  latest={m.id === lastId}
                                  onOpen={openPanel}
                                />
                                {/* The resume citation opens the panel; the
                                    file also gets its own chip, a real
                                    anchor, so it works whether or not the
                                    model wrote a link. */}
                                {o.type === "tool-showResume" && (
                                  <a
                                    href={RESUME_PDF}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={RESUME_PDF_FILENAME}
                                    className={`border px-3 py-2.5 t-meta no-underline transition-colors hover:border-accent hover:text-accent ${
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

                {/* Names the step rather than the wait. Keyed by phase so a step
                    change restarts the entry animation; the elapsed count isn't
                    keyed, so it measures the whole turn. */}
                {(phase || stallable) && (
                  <div className="flex items-center gap-3">
                    {phase && <PhaseLine key={phase} phase={phase} elapsed={elapsed} />}
                    {/* A way out of a turn that's taking too long, and only then:
                        offering stop against a two-second answer is noise. It
                        outlives the phase line, because a job-posting answer
                        can stream for most of a minute after its first token,
                        and that's when a reader wants out. */}
                    {stallable && (
                      <button
                        type="button"
                        onClick={stop}
                        data-js-control
                        className="flex min-h-[44px] shrink-0 touch-manipulation items-center t-meta text-text-faint transition-colors hover:text-accent"
                      >
                        stop
                      </button>
                    )}
                  </div>
                )}
                {errorKind === "error" && (
                  <TurnError
                    errorClass={errorClass}
                    onRetry={retry}
                    model={model}
                    onSwitchModel={(next) => {
                      setModel(next);
                      retry(next);
                    }}
                  />
                )}
                {/* Out of turns: manual mode puts the corpus itself in the
                    chat's place, with no model and no tokens. */}
                {errorKind === "rate_limited" && (
                  <ManualMode headline={RATE_LIMIT_STATE} onOpenSource={openPanel} />
                )}
                {/* The conversation cap, said as itself rather than as the
                    hourly budget, with the one tap that fixes it. */}
                {full && !isBusy && (
                  <div className="space-y-3 border-l-2 border-accent bg-raised px-3 py-3">
                    <p className="t-body text-text-soft">{CONVERSATION_FULL}</p>
                    <button
                      type="button"
                      onClick={() => {
                        goHome();
                        if (!isMobile) requestAnimationFrame(() => inputRef.current?.focus());
                      }}
                      data-js-control
                      className="flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 text-[13px] text-text-soft transition-colors hover:border-accent hover:text-accent"
                    >
                      {CONVERSATION_FULL_ACTION}
                    </button>
                  </div>
                )}
              </div>

              {idle && <IdleLine key={idleIndex} line={IDLE_LINES[idleIndex]!} />}
            </div>
          </div>

          {/* Input. The bottom padding keeps the row clear of the home
              indicator on notched iPhones; it resolves to 0 elsewhere. */}
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
                    className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left t-meta hover:bg-raised md:px-10"
                  >
                    <span className="text-accent">{c.name}</span>
                    <span className="text-text-faint">{c.hint}</span>
                  </button>
                ))}
              </div>
            )}
            {/* The conversation a reload, Home or Back left behind, one tap
                from coming back. In the dock at every width, beside the
                composer that would otherwise replace it, which the hint says
                rather than letting a new question discard it unannounced. */}
            {!hasMessages && saved && (
              <div className="flex min-h-11 items-center gap-3 border-b border-line px-4 text-[14px] md:px-10 md:text-[13px]">
                <button
                  type="button"
                  onClick={continueSaved}
                  disabled={!hydrated}
                  data-js-control
                  className="flex min-h-[44px] min-w-0 touch-manipulation items-center gap-2 text-left text-text transition-colors hover:text-accent"
                >
                  <span aria-hidden="true" className="text-accent">
                    ↩
                  </span>
                  <span className="min-w-0 truncate underline decoration-line-strong underline-offset-4">
                    {CONTINUE_LABEL}
                  </span>
                  <span className="hidden shrink-0 text-text-faint sm:inline">
                    · {questionCount(saved.messages.filter((m) => m.role === "user").length)}
                  </span>
                </button>
                <span className="hidden min-w-0 truncate text-text-faint lg:inline">
                  {CONTINUE_HINT}
                </span>
                <button
                  type="button"
                  onClick={clearSaved}
                  data-js-control
                  aria-label="Clear the saved conversation"
                  className="ml-auto flex min-h-[44px] shrink-0 touch-manipulation items-center text-text-faint transition-colors hover:text-accent"
                >
                  {CLEAR_LABEL}
                </button>
              </div>
            )}
            {/* From md up the chips sit here, over the composer — the whole
                interview affordance in one dock: suggested questions, the
                input, and the proof line under it.

                One line, never two. The three need about 1,100px side by
                side, so where the row is narrower — a 1024px window, or a
                laptop with the context panel open — the last and longest
                one drops out of the dock. A container query rather than a
                breakpoint, because the panel narrows the row without the
                viewport changing. /fit still sends it. */}
            {!hasMessages && (
              <div className="hidden px-4 pt-3 md:block md:px-10">
                <div className="@container flex gap-2 [&>:last-child]:hidden @min-[1120px]:[&>:last-child]:block">
                  {chipButtons}
                </div>
              </div>
            )}
            <form
              // No native submit, ever. A form with no action submits by
              // navigating to the current URL with the fields in the query
              // string, and disabling the button doesn't stop
              // `requestSubmit()` from an extension or future code. Per the
              // HTML submit algorithm, a method="dialog" form outside a
              // <dialog> does nothing on submit but still fires the submit
              // event, so Enter still sends and the page can't navigate
              // whether the JavaScript has arrived, hasn't yet, or threw.
              method="dialog"
              // The composer grows, so the height is a floor, and the prompt
              // aligns to the first line rather than the middle of a long
              // paste.
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
                  // Enter sends; Shift+Enter is a newline.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    trySend();
                  }
                  if (e.key === "Escape") setInput("");
                }}
                id="ask"
                // Disabled until hydration: the page can't send a question
                // yet, and a field that can't be typed into can't fire an
                // implicit submit on Enter.
                // Also off at the conversation cap, where the placeholder and
                // the notice above say why: a field that takes a question it
                // can't send is a dead end.
                disabled={!hydrated || full}
                // Phones and conversations get the short placeholder, which
                // survives a 320px screen; the empty state on a desktop gets
                // HERO_SUB. isMobile is settled by the time hydration lifts
                // this gate. The slash menu advertises itself once "/" is
                // typed.
                placeholder={
                  !hydrated
                    ? "Loading the conversation…"
                    : full
                      ? CONVERSATION_FULL_PLACEHOLDER
                      : hasMessages || isMobile
                        ? "Ask a question"
                        : HERO_SUB
                }
                aria-label="Ask a question"
                enterKeyHint="send"
                // 16px below md because iOS Safari zooms into any focused field
                // under 16px and doesn't zoom back out; maximum-scale=1 would
                // fix that only by disabling pinch-zoom for everyone.
                //
                // The field carries the row's vertical padding, so a one-line
                // composer is a full 48px tap target. max-h caps growth at
                // eight lines and scrolls past that, so a long pasted posting
                // doesn't swallow the conversation.
                className={`ml-2 max-h-[216px] min-h-[48px] min-w-0 flex-1 resize-none bg-transparent py-3 text-[16px] leading-[1.6] text-text outline-none placeholder:text-text-faint disabled:placeholder:text-text-dim md:text-[15px] ${
                  full ? "disabled:cursor-not-allowed" : "disabled:cursor-progress"
                }`}
              />
              {/* One send control at every width: bordered, labelled, 44px
                  tall and legible when disabled. my-1.5 centres it on the
                  first line of a growing field. */}
              <button
                type="submit"
                // Disabled until hydration, so a press before the JavaScript
                // arrives shows it can't send yet rather than silently doing
                // nothing.
                disabled={!hydrated || !input.trim() || isBusy || full}
                className="-mr-1.5 my-1.5 ml-2 disabled:cursor-progress flex h-11 min-w-[44px] shrink-0 touch-manipulation items-center justify-center border border-line-strong bg-raised px-3 t-meta text-text-soft transition-colors hover:border-accent hover:text-accent disabled:border-line disabled:text-text-dim"
              >
                send ↵
              </button>
            </form>

            {/* One line of fine print and a link to the colophon, which
                carries the credibility claims. A phone gets the short
                sentence because the long one wraps to two lines at 390px.
                Gone once a conversation starts: answers then carry their own
                sources, and the actions strip takes this row. */}
            {!hasMessages && (
              <p className="t-meta px-4 pb-3 text-text-faint md:px-10">
                <span className="lg:hidden">{DISCLAIMER_SHORT}</span>
                <span className="hidden lg:inline">{DISCLAIMER_LONG}</span>{" "}
                <Link
                  href="/colophon"
                  className="-my-2 py-2 text-text-soft underline decoration-line-strong underline-offset-2 hover:text-accent"
                >
                  How it works
                </Link>
              </p>
            )}

            {/* ---- Actions strip ---------------------------------------
                Quiet and present from the first turn; it gains a little
                weight after an action instead of interrupting. Scrolls
                horizontally rather than wrapping on a narrow phone, so the
                input row above never moves. */}
            <div
              // The fade is the only sign this row scrolls; a phone shows no
              // scrollbar.
              style={{
                maskImage: "linear-gradient(to right, black 85%, transparent)",
                WebkitMaskImage: "linear-gradient(to right, black 85%, transparent)",
              }}
              // Conversation-only: the empty state's dock carries the chips and
              // the fine print instead. Pasting a posting straight into the
              // composer works too; the route's detector, not this entry,
              // starts the job-posting flow.
              className={`h-11 items-center gap-4 overflow-x-auto whitespace-nowrap border-t px-4 t-meta transition-colors md:px-10 ${
                hasMessages ? "flex" : "hidden"
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
                disabled={!hydrated}
                // Desktop only; on a phone the index entry is the way in.
                className="hidden md:flex"
              />
              {/* No "reset" here any more: the way out is Home in the
                  conversation bar, and it keeps the conversation to continue
                  rather than deleting it from the bottom corner. */}
            </div>
          </div>
        </main>

        {/* Context panel — desktop, resizable */}
        {panelOpen && (
          <>
            {/* Keyboard-operable splitter: arrows nudge, shift-arrows jump,
                Home and End go to the stops, and Enter (like a double click)
                restores the default. aria-valuenow makes the width audible. */}
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
            {/* Labelled with the title its header shows, so it's an
                identifiable landmark rather than an unnamed region. */}
            <aside
              aria-label={panelTitle(panel)}
              style={{ width: panelWidth }}
              className="hidden shrink-0 flex-col border-l border-line bg-panel lg:flex"
            >
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4 t-meta">
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

      {/* ---- Sheets -------------------------------------------------------
          Fetched at idle or on the first thing that needs a sheet. The index
          sheet opens at every width; the bottom panel sheet is mobile-only
          because `sheetOpen` is only set where `isMobile` holds. */}
      {(idleReady || railOpen || panelOpen) && (
        <MobileSheets
          rail={{
            open: railOpen,
            onOpenChange: setRailOpen,
            onClosed: () => railTriggerRef.current?.focus(),
            content: <RailContent onOpenPanel={openPanel} hydrated={hydrated} />,
          }}
          panel={{
            open: panelOpen,
            sheetOpen,
            onOpen: () => setSheetOpen(true),
            onClose: closePanel,
            onClosed: () => {
              const opener = panelOpenerRef.current;
              if (opener?.isConnected && opener.offsetParent !== null) opener.focus();
              else inputRef.current?.focus();
            },
            title: panelTitle(panel),
            content: panelContent,
            full: sheetFull,
            onToggleFull: () => setSheetFull((v) => !v),
          }}
          readouts={readouts}
        />
      )}
      </div>
    </>
  );
}

// The index: the full destination list, rendered inside the index sheet,
// whose header carries the title.
function RailContent({
  onOpenPanel,
  hydrated,
}: {
  onOpenPanel: (v: PanelView) => void;
  /** Rail entries with no href need JavaScript; see RailLink. */
  hydrated: boolean;
}) {
  const group = (g: RailGroup) => (
    <section key={g.label} aria-label={g.label} className="mt-5 first:mt-2">
      <h2 className="t-label text-text-faint">{g.label}</h2>
      <div className="mt-1 flex flex-col">
        {g.items.map((item) => (
          <RailLink key={item.label} item={item} onOpenPanel={onOpenPanel} hydrated={hydrated} />
        ))}
      </div>
    </section>
  );
  return (
    <>
      {group(RAIL_WORK)}
      {/* Drawn by the shell rather than listed: the address is on screen and
          copyable here too, as on the front door. */}
      <section aria-label={RAIL_CONTACT_LABEL} className="mt-5">
        <h2 className="t-label text-text-faint">{RAIL_CONTACT_LABEL}</h2>
        <div className="mt-2 flex flex-col">
          <EmailCopy surface="index" />
          {SOCIAL_LINKS.filter((s) => s.label !== "Email").map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[44px] items-center border-b border-line py-2 text-text-soft no-underline transition-colors hover:text-accent"
            >
              {s.label} ↗
            </a>
          ))}
        </div>
      </section>
      {group(RAIL_HOW)}
    </>
  );
}

function RailLink({
  item,
  onOpenPanel,
  hydrated,
}: {
  item: RailItem;
  onOpenPanel: (v: PanelView) => void;
  hydrated: boolean;
}) {
  // min-h plus items-center makes each row a full 44px target without changing
  // how it looks.
  const cls =
    "flex min-h-[44px] items-center border-b border-line py-2 text-left text-text-soft no-underline transition-colors hover:text-accent";

  // Hoisted so the click handlers close over a narrowed value — TypeScript
  // drops narrowing on a property once it crosses into a callback.
  const view = item.view;

  if (item.external && item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        {...downloadAs(item.href)}
        className={cls}
      >
        {item.label} ↗
      </a>
    );
  }

  // Rendered as a real anchor so cmd-click, middle-click and "open in new tab"
  // reach the standalone page, and so crawlers see a link. A plain left-click
  // is intercepted and opens the panel instead; usePanelUrl pushes the same
  // href into the address bar.
  if (view && item.href) {
    return (
      <a
        href={item.href}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onOpenPanel(view);
        }}
        className={cls}
      >
        {item.label} →
      </a>
    );
  }

  if (view) {
    return (
      // Entries with no page of their own can only open a panel, which needs
      // JavaScript. The anchors above still work before hydration by
      // navigating.
      <button
        type="button"
        onClick={() => onOpenPanel(view)}
        disabled={!hydrated}
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

// One action in the strip. Emphasis is a colour step, not a new element, so
// the strip is the same shape before and after.
function StripButton({
  label,
  emphasis,
  onClick,
  disabled,
  className = "flex",
}: {
  label: string;
  emphasis: boolean;
  onClick: () => void;
  /** Only the job-description entry is on screen before hydration. */
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-js-control
      // Full-height, so the hit area is the 44px strip rather than the text.
      className={`${className} focus-inset h-full shrink-0 touch-manipulation items-center transition-colors hover:text-accent ${
        emphasis ? "text-text-soft" : "text-text-faint"
      }`}
    >
      {label}
    </button>
  );
}

// The idle one-liner fades in rather than typing itself out: one ambient motion
// at a time, and the backdrop wave is it. The caret is punctuation and doesn't
// pulse. The quietest thing on the page, below the conversation.
function IdleLine({ line }: { line: string }) {
  return (
    <p className="t-meta animate-idle-line pt-6 text-text-faint">
      {line}
      <span className="text-accent">▍</span>
    </p>
  );
}

// Sits under an answer and reopens the evidence it was built from. On mobile,
// where tool calls don't raise the panel sheet, this is the way into it, so
// the newest turn's chips are marked.
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
    // A slug without a SLUG_TO_RESUME entry (Dell) opens the projects list.
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
      className={`border px-3 py-2.5 t-meta transition-colors hover:border-accent hover:text-accent ${
        latest ? "border-line-strong text-text-soft" : "border-line text-text-faint"
      }`}
    >
      ↗ {label}
    </button>
  );
}
