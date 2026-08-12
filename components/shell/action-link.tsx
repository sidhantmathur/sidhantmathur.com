import Link from "next/link";
import type { ReactNode } from "react";

// The bordered "here is the thing to do next" control, in its one form.
//
// It was written twice — `PanelLink` in panel-body.tsx and `ManualLink` in
// manual-mode.tsx — with a byte-identical class string and the same three
// branches, because the two files were built a sprint apart and neither had a
// place to put a shared one. Two copies of a touch target is exactly the kind
// of duplicate that goes wrong quietly: py-2.5 rather than py-1 is a measured
// fix (below lg every panel is a sheet, so these are thumbs, and 11px text
// with 4px of padding made a 26px button) and it only ever got applied to
// whichever copy the person was looking at.
//
// Its own module rather than an export from either file: panel-body.tsx and
// manual-mode.tsx are separate lazy chunks, and importing one from the other to
// borrow a link would drag a whole panel renderer into the rate-limited state's
// bundle.
//
// The trailing glyph is the affordance, not decoration: ↗ leaves the site, →
// stays on it.
type ActionLinkProps = { children: ReactNode } & (
  // A destination or an action, never both and never neither. The old
  // ManualLink took `href?` and fell back to "/" when it got nothing, which is
  // a link to the homepage standing in for a bug.
  | { href: string; external?: boolean; onClick?: never }
  | { onClick: () => void; href?: never; external?: never }
);

const CLASS =
  "inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 text-[13px] text-text-soft no-underline transition-colors hover:border-accent hover:text-accent";

export function ActionLink({ href, external, onClick, children }: ActionLinkProps) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={CLASS}>
        {children} →
      </button>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={CLASS}>
        {children} ↗
      </a>
    );
  }
  return (
    <Link href={href!} className={CLASS}>
      {children} →
    </Link>
  );
}
