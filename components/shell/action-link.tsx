import Link from "next/link";
import type { ReactNode } from "react";
import { downloadAs } from "@/lib/site";

// The bordered "here is the thing to do next" control, shared by panel-body.tsx
// and manual-mode.tsx. Its own module because those two are separate lazy
// chunks, and importing one from the other would pull a whole panel renderer
// into the other's bundle.
//
// The padding and 44px minimum height are the touch target: below lg every
// panel is a sheet. The trailing glyph is the affordance: ↗ leaves the site, →
// stays on it.
type ActionLinkProps = { children: ReactNode } & (
  // A destination or an action, never both and never neither.
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
      <a href={href} target="_blank" rel="noreferrer" {...downloadAs(href)} className={CLASS}>
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
