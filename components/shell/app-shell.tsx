"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { JD_COPY } from "./shell-data";
import { usePanelUrl } from "./use-panel-url";
import { panelTitle } from "./panel-title";
import { useTokenRate } from "./use-token-rate";
import { useTeletype } from "./use-teletype";
import { useHydrated } from "./use-hydrated";
import { useIdleReady } from "./use-idle-ready";
import { useIdle } from "./use-idle";
import { useElapsed } from "./use-elapsed";
import { AmbientBackdrop } from "./ambient-backdrop";
import { RailContent } from "./rail-content";
import { IdleLine, useIdleLine } from "./idle-line";
import { useTurnAnnouncement } from "./use-turn-announcement";
import { useMediaQuery } from "./use-media-query";
import { usePanelWidth } from "./use-panel-width";
import { useStickToBottom } from "./use-stick-to-bottom";
import { useExportActions, useStripEmphasis } from "./use-export-actions";
import { StatusStrip } from "./status-strip";
import { ConversationBar } from "./conversation-bar";
import { ReplayBanner } from "./replay-banner";
import { ChipDock, ContinueRow, FrontDoor, SuggestedChips } from "./front-door";
import { TranscriptView } from "./transcript-view";
import { Composer } from "./composer";
import { ActionsStrip } from "./actions-strip";
import { ContextPanel } from "./context-panel";
import { latestRoleFit } from "@/lib/transcript";
import { isJdPrefix } from "@/lib/job-posting";
import { costOfTurn, sumCosts } from "@/lib/pricing";
import { MODEL_IDS } from "@/lib/models";
import { isShellPanel, type ShellPanelKind } from "./panels";
import { type ReadoutState } from "./readouts";
import {
  pushChatEntry,
  pushHomeEntry,
  useConversationHistory,
} from "./conversation-history";
import { textOf, useConversation, type PanelView } from "./use-conversation";

// The page at "/": the front door, the conversation that replaces it, and the
// panels and sheets around both. This file holds the state that crosses
// regions and the layout skeleton; each region is its own component beside it
// (docs/app-shell-split.md):
//
//   status-strip.tsx      the header
//   conversation-bar.tsx  Home and the question count, in a conversation
//   replay-banner.tsx     what a replayed conversation says about itself
//   front-door.tsx        the front door, the chips, the continue row
//   transcript-view.tsx   the turns, the phase line, failures, the cap notice
//   composer.tsx          the dock: slash menu, composer, fine print
//   actions-strip.tsx     copy, export, link and paste-a-posting
//   context-panel.tsx     the desktop panel and its splitter
//   rail-content.tsx      the index, inside the index sheet
//
// The refs that cross regions stay here: inputRef (the composer, the cap
// notice and the panel sheet's focus return), railTriggerRef (the header and
// the index sheet), panelOpenerRef (openPanel and the panel sheet) and the
// scroll container (use-stick-to-bottom.ts).

// ---------------------------------------------------------------------------
// Loaded on demand
// ---------------------------------------------------------------------------
// The homepage's first load on a throttled phone is bandwidth-bound, so
// anything a visitor can't reach without first doing something (opening a
// panel, failing a turn, raising a sheet) stays out of the entry chunk.
// `ssr: false` throughout: each one renders only behind client state, so
// pre-rendering would add markup nobody can see yet. Every dynamic() call
// stays in this file, and the regions get the components as props, so no
// region can pull one into the entry chunk by importing it.
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
// docs/copy-ledger.md. Each region keeps its own; this one has two readers
// (manual mode and the instrument deck), so it stays here.
// ---------------------------------------------------------------------------
// Per-class error copy lives in lib/chat-telemetry.ts, rendered by TurnError.
const RATE_LIMIT_STATE =
  "You've hit the message limit for now. The resume has everything in the meantime.";

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
    stoppable,
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
  const idleLine = useIdleLine(idle);

  // What the polite status region says when a turn completes; see
  // use-turn-announcement.ts. Rendered outside the shell, below.
  const announcement = useTurnAnnouncement(messages, isBusy, errorKind);

  const [railOpen, setRailOpen] = useState(false);
  // ---- Where focus goes when a sheet closes --------------------------------
  //
  // The dialog primitive doesn't hand focus back to whatever opened it (closing
  // the rail sheet dropped focus on <body>), so the shell restores it itself.
  const railTriggerRef = useRef<HTMLButtonElement>(null);
  const panelOpenerRef = useRef<HTMLElement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFull, setSheetFull] = useState(false);
  const panelWidth = usePanelWidth();

  // ---- Export and the actions strip ----------------------------------------
  //
  // The strip's emphasis is read by openPanel below, and the export actions
  // need openPanel, so they are two hooks; see use-export-actions.ts.
  const { emphasis, bumpStrip } = useStripEmphasis();

  // Below lg the panel is a bottom sheet instead of the resizable aside.
  // Starts false so the first client render matches the server; both sheets
  // are closed at mount, so there's nothing to flash.
  const isMobile = useMediaQuery("(max-width: 1023px)");

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

  // Stick-to-bottom; see use-stick-to-bottom.ts.
  const { scrollRef, onScroll, pin } = useStickToBottom(messages, replayed);

  // The composer's field. Owned here because three regions reach for it: the
  // composer, the conversation-full notice and the panel sheet's focus return.
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Every way of asking goes through here: the composer, the chips, a slash
  // command and the job-description panel. The first question from the front
  // door is where a conversation begins, so it gets its own history entry, and
  // Back from the conversation returns to the front door instead of leaving
  // the site.
  function ask(text: string) {
    if (!messages.length) pushChatEntry();
    pin();
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
  }, [leave, scrollRef]);

  function goHome() {
    if (messages.length) pushHomeEntry();
    showFrontDoor();
  }

  // Back into the saved conversation at its latest answer, as it was left.
  const resumeAtEnd = useCallback(() => {
    pin();
    resume();
  }, [pin, resume]);

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

  // The permalink, the copied conversation and the strip's copy-link; see
  // use-export-actions.ts.
  const { permalink, setPermalink, conversationMarkdown, copyLink } = useExportActions({
    messages,
    bumpStrip,
    openPanel,
  });

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

  // The suggested-question chips, rendered in two places by width; see
  // SuggestedChips in front-door.tsx.
  const chips = <SuggestedChips onAsk={ask} disabled={isBusy || !hydrated} />;

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

      <StatusStrip
        railTriggerRef={railTriggerRef}
        onOpenRail={() => setRailOpen(true)}
        hydrated={hydrated}
        onHome={goHome}
        hasMessages={hasMessages}
        onOpenPanel={openPanel}
        turns={turns}
        lastAnswerCost={lastAnswerCost}
      />

      {/* ---- Body --------------------------------------------------------- */}
      <div className="flex min-h-0 flex-1">
        {/* Conversation. */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* Under the empty state, back during idle, gone while a
              conversation is on screen. Behind the scroll area rather than
              inside it, so it doesn't scroll with the transcript. */}
          <AmbientBackdrop visible={!hasMessages || idle} />
          {hasMessages && <ConversationBar onHome={goHome} replayed={replayed} turns={turns} />}
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
              // The front door is a little wider than the transcript: at 68ch
              // its three actions wrapped LinkedIn onto a row of its own at
              // 1280px. Every prose block inside it keeps its own measure.
              className={`mx-auto ${hasMessages ? "max-w-[68ch]" : "max-w-[76ch]"} transition-opacity duration-700 ${
                idle ? "opacity-90" : "opacity-100"
              }`}
            >
              {replayed && (
                <ReplayBanner
                  replayedFit={replayedFit}
                  postingLeftOut={postingLeftOut}
                  onHome={goHome}
                />
              )}

              {!hasMessages && (
                <FrontDoor chips={chips} />
              )}

              <TranscriptView
                messages={messages}
                isBusy={isBusy}
                lastId={lastId}
                phase={phase}
                elapsed={elapsed}
                errorKind={errorKind}
                errorClass={errorClass}
                model={model}
                onRetry={retry}
                onSwitchModel={(next) => {
                  setModel(next);
                  retry(next);
                }}
                onOpenSource={openPanel}
                ManualMode={ManualMode}
                rateLimitHeadline={RATE_LIMIT_STATE}
                full={full}
                onStartNew={() => {
                  goHome();
                  if (!isMobile) requestAnimationFrame(() => inputRef.current?.focus());
                }}
              />

              {idle && <IdleLine key={idleLine.index} line={idleLine.line} />}
            </div>
          </div>

          <Composer
            inputRef={inputRef}
            hydrated={hydrated}
            full={full}
            isBusy={isBusy}
            stoppable={stoppable}
            onStop={stop}
            hasMessages={hasMessages}
            isMobile={isMobile}
            onAsk={ask}
            onOpenPanel={openPanel}
            above={
              <>
                {!hasMessages && saved && (
                  <ContinueRow
                    questions={saved.messages.filter((m) => m.role === "user").length}
                    hydrated={hydrated}
                    onContinue={continueSaved}
                    onClear={clearSaved}
                  />
                )}
                {!hasMessages && <ChipDock>{chips}</ChipDock>}
              </>
            }
            below={
              <ActionsStrip
                hasMessages={hasMessages}
                emphasis={emphasis}
                hydrated={hydrated}
                getMarkdown={conversationMarkdown}
                onAction={bumpStrip}
                onExport={() => openPanel({ kind: "export" })}
                onCopyLink={copyLink}
                onPasteJd={() => openPanel({ kind: "jd" })}
              />
            }
          />
        </main>

        {panelOpen && (
          <ContextPanel title={panelTitle(panel)} width={panelWidth} onClose={closePanel}>
            {panelContent}
          </ContextPanel>
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
