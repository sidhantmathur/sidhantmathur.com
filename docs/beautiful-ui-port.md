# The beautiful-ui port — what was taken, what wasn't

Branch: `feat/chat-polish-beautiful-ui`, cut from `feat/chat-polish-aicss`.

Source: <https://beautiful-ui-five.vercel.app/> — seventeen components, no registry,
no package, no `llms.txt`. It is a rendered showcase rather than an installable
library, so nothing here was installed; the applicable parts were read off the
page's markup and stylesheet and rebuilt against this site's tokens.

## The judgement

**Its skin is wrong for this site and was not taken.** It is a light-mode SaaS
kit: `rounded-xl` message bubbles, right-aligned user turns, layered drop
shadows (`--shadow-card`, `--shadow-raised`, `--shadow-overlay`), a blue accent,
and a white-on-grey surface stack. Every one of those is something this site
decided against on purpose — radius 0, the ledger-entry user turn that exists
specifically to break the chat-bubble silhouette, one accent, a dark palette.
Adopting the skin would not have been a redesign, it would have been a deletion
of the site's differentiation.

**Its motion craft is better than ours was, and that part is portable.** Five
things, all of which survive the change of palette because none of them depend
on it.

## Taken

| From | Was | Is now |
| --- | --- | --- |
| `shimmer-text` | `animate-pulse` on the phase line — a whole-line opacity throb | A gradient swept through clipped text. A throb says "something is happening"; a sweep says "something is being read" |
| `pixel-on` | nothing | A 3×3 grid of accent cells blinking on a stagger, beside the phase name. Square, not `rounded-[1px]` |
| elapsed counter | nothing | Tenths of a second, monospace and tabular, while a turn is in flight |
| `stream-in` | messages appeared | A turn resolves in — opacity plus a 4px blur clearing over 400ms |
| `0fr → 1fr` grid disclosure | `{open && …}`, a hard mount | The trace row animates open with no measurement, no ref and no `ResizeObserver` |
| `cubic-bezier(.23,1,.32,1)` | Tailwind defaults, unevenly applied | `--ease-out-strong`, one curve for the shell |

Two additions are ours rather than ports, prompted by looking at theirs:

- **The streaming caret.** Their streaming-text demo ends in a caret and this
  site had no marker anywhere in the message column for "still arriving" — the
  phase line deliberately disappears the moment prose exists, so for the whole
  body of a long answer nothing said the turn was unfinished. It uses the `▍`
  the idle line already uses, so it reads as the same cursor.
- **The elapsed counter** is the readout a site that measures itself was
  conspicuously missing: `ttft` in the status strip only fills in once the wait
  is over, which is exactly too late to be reassuring.

## Rejected, with reasons

- **Chat panel, tabs, bubbles, composer** — the composer was just rebuilt
  (`c930843`) and the bubble is the thing this site refuses.
- **Tool chips, task rows, thinking drawer** — an expandable reasoning trace in
  the message column is precisely what the instrumentation policy exists to
  refuse. Density lives *around* the conversation; that is what the instrument
  deck is.
- **Code block** — ours omits syntax highlighting deliberately (a parser
  dependency and a second palette, on a site that is one mono face on one
  background). Theirs is prettier and would cost that argument.
- **Source cards with favicons** — their sources are websites. Ours are corpus
  chunks checked by `lib/verify.ts`; there are no favicons, and the chips are
  wired to the verifier rather than decorative.
- **Approval card, recommendation card, diff/records/filter tables, sidebar nav,
  search, insight cards, fine-tune card** — SaaS application furniture with no
  surface on a portfolio site.

## Correctness notes

Two things needed fixing that the source does not handle:

1. **Reduced motion.** The global rule in `globals.css` collapses animations to
   0.01ms with one iteration, which parks them on their *final* keyframe — for
   `shimmer-text` that is a gradient swept off the end of transparent-filled
   text (invisible), and for `pixel-on` it is `opacity: .15` (a grid of ghosts).
   Both get explicit still-frame fallbacks. Verified under emulated
   `prefers-reduced-motion: reduce`.
2. **The clipped disclosure row** is hidden but still mounted, so it carries
   `inert` when closed — otherwise a screen reader reads twenty rows of numbers
   out of a control reporting `aria-expanded="false"`.

## Verified

`npm run build` and `npm run lint` both clean. Rendering checked in a browser
against a live turn: nine pixels, the shimmering step name, the counter ticking
0.1 → 0.8s, `aria-live="polite"`; the caret inline at the writing edge in the
accent and gone on settle; the trace row animating 0px → 364px with `inert`
toggling. The React compiler flagged two real defects during this work (a
render-phase mutation in `markdown.tsx`, a cascading `setState` in
`use-elapsed.ts`); both are fixed properly rather than suppressed.
