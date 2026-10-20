# Splitting `components/shell/app-shell.tsx`

A proposal, not yet done. Written during the comment cleanup of 2026-10-19, after
which the file is about 1,490 lines (it was about 1,740).

## What's in the file now

One client component, `AppShell`, of about 1,120 lines: roughly 420 of state,
effects and callbacks, then 700 of JSX. Below it, five local components that
take only props: `RailContent`, `RailLink`, `StripButton`, `IdleLine` and
`CitationChip` (about 210 lines together).

Conversation state is already out (`useConversation`, `usePanelUrl`), and so are
the instruments' hooks. What's left in `AppShell` falls into clusters that
barely touch each other:

| Cluster | State it owns | Reads from elsewhere |
|---|---|---|
| Instruments and readouts | `streamingText`, rate, teletype, elapsed, `stallable`, session cost, last answer cost | `messages`, `isBusy`, `turnLog`, `turns`, `ttft`, `model` |
| Idle line | `idleIndex` and its interval | `useIdle(!isBusy)` |
| Announcements | `announcement`, `announcedCount` | `messages`, `isBusy`, `errorKind` |
| Panel layout | `panelWidth`, drag ref, localStorage, keyboard splitter, `isMobile` | `panel` |
| Sheets and focus | `railOpen`, `sheetOpen`, `sheetFull`, `railTriggerRef`, `panelOpenerRef`, `openPanel`, `closePanel` | `isMobile`, `setPanel`, `bumpStrip` |
| Export actions | `builtLink`/`permalink`, `emphasis`/`bumpStrip`, `linkCopied`, `copyLink`, `conversationMarkdown` | `messages`, `openPanel` |
| Composer | `input`, autosize effect, slash matching, `runSlash`, `trySend`, `submitJd` | `submit`, `isBusy`, `hydrated`, `stick` |
| Scroll | `scrollRef`, `stick`, stick-to-bottom effect | `messages`, `replayed` |

The JSX has matching regions: the print document and the live-region announcer
(siblings of the shell, on purpose), the status strip header (~105 lines), the
replay banner (~25), the front door (~95), the transcript with phase line, stop
button, error and manual mode (~165), the composer dock with slash menu, chip
dock, form, fine print and actions strip (~250), the desktop panel and splitter
(~65), and the sheets wiring (~35).

## Proposed seams

New files, all in `components/shell/`:

- `rail-content.tsx`: `RailContent` and `RailLink`, moved as they are.
- `citation-chip.tsx`: `CitationChip`.
- `actions-strip.tsx`: the strip and `StripButton`. Props: the export actions,
  `emphasis`, `hydrated`, `hasMessages`, `reset`, `openPanel`.
- `use-turn-announcement.ts`: returns the announcement string from `messages`,
  `isBusy` and `errorKind`. The announcer `<p>` stays in `AppShell`.
- `use-panel-width.ts`: width, drag handling, keyboard handler, persistence and
  the `PANEL_*` constants. Returns props for the splitter and the aside width.
- `use-media-query.ts`: the `isMobile` effect, generalised.
- `use-export-actions.ts`: permalink, strip emphasis, copy link, conversation
  markdown.
- `replay-banner.tsx` and `front-door.tsx`: each takes its copy constants with
  it (`REPLAY_*`; `HERO`, `HERO_SUB`). The suggested-question chips become a
  `SuggestedChips` component rendered in both places instead of a JSX array
  built in `AppShell`.
- `status-strip.tsx`: the header.
- `composer.tsx`: slash menu, form, textarea, send button and fine print, with
  the autosize effect and slash logic. `input` state can move inside it.
- `transcript-view.tsx`: the message list, phase line, stop button, `TurnError`
  and `ManualMode`.
- `context-panel.tsx`: the splitter and the desktop aside.

`AppShell` would keep the lazy imports, the hooks' wiring, the refs that cross
regions, and the layout skeleton: an estimated 350–450 lines.

## Order

Lowest risk first, one commit each, each verified before the next:

1. **Move the prop-only components** (`RailContent`, `RailLink`, `CitationChip`,
   `StripButton`, `IdleLine`). Pure moves; nothing about state changes.
2. **Extract the self-contained hooks**: announcements, media query, panel width.
   No JSX moves.
3. **Replay banner and front door.** Static JSX plus a few props.
4. **Status strip.**
5. **Export actions hook and actions strip.**
6. **Context panel.**
7. **Composer, then transcript view.** Last, because they share the most state
   with everything else (see the refs below).

## Risks and how to hold them

- **Evals read this file's source.** These assert on text in
  `app-shell.tsx` and must follow the code to its new file in the same commit:
  `evals/track-b.test.mjs` (three tests: `<RecruiterTldr />` and `<CaseCards />`
  inside the `{!hasMessages && (` branch, and the old chip text being absent),
  `evals/application-links.test.mjs` (the `replay-` id check and the three
  `surface="replay"` buttons), `evals/static.test.mjs` (the `submitJd` prefix
  format), `evals/recursion.test.mjs` (`ManualMode` behind
  `errorKind === "rate_limited"`), and `evals/export.test.mjs` (`screen-only`).
  Some of these are better as behaviour tests; that's worth doing, but as its
  own change.
- **Hydration gating.** Every control that needs JavaScript carries
  `disabled={!hydrated}` and `data-js-control`, and
  `scripts/check-pre-hydration.mjs` depends on both. Pass `hydrated` down from
  `AppShell` rather than calling `useHydrated()` in each new component, so there
  is one source.
- **Lazy chunks.** The `dynamic()` imports at the top keep panel bodies,
  instruments, export, manual mode, sheets and the print document out of the
  entry chunk. A new module must not import those statically. Keep every
  `dynamic()` call in `AppShell` (or one `lazy.ts`) and pass the components in.
  `npm run perf` and the build's chunk sizes show a regression.
- **Refs that cross regions.** `inputRef` is used by the composer, by the front
  door's "Interview this site" link and by the panel sheet's focus return.
  `railTriggerRef` by the status strip and the rail sheet. `panelOpenerRef` by
  `openPanel` and the panel sheet. `stick` by the composer, the chips, slash
  commands and the scroll effect. Keep all four owned by `AppShell` and pass
  them as props (React 19 takes `ref` as a prop); a `useStickToBottom` hook can
  return `{ scrollRef, onScroll, pin }`.
- **Placement that is load-bearing.** The print document must stay a sibling of
  `.screen-only`, and the announcer must stay outside both the shell and the
  print document (Radix spares any subtree with `[aria-live]` from its
  aria-hidden marking, and `npm run a11y` checks the sheet is modal). Neither
  should move into a subcomponent.
- **The form.** `method="dialog"` on the composer form is what makes native
  submit impossible before hydration. It moves with the composer unchanged.

## Verification for every step

`npm run lint`, the static evals, `npm run build` (including the post-build
marker check), `npm run check:load`, `npm run a11y`, and screenshots with
`npm run shot -- /` at desktop and `--mobile`: the empty state, a conversation,
the panel open, and the index sheet open. A pure move should produce no visual
change at all.
