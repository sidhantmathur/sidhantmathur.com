"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

type MonoLinkVariant = "internal" | "external" | "mailto";

type MonoLinkProps = {
  href: string;
  variant: MonoLinkVariant;
  className?: string;
  children: React.ReactNode;
  /** When set, fires a contact_click PostHog event on click (safe no-op when
   *  analytics is unconfigured). Used for footer/header contact links. */
  contact?: "email" | "github" | "linkedin";
};

const SUFFIX: Record<MonoLinkVariant, string> = {
  internal: "→",
  external: "↗",
  mailto: "↗",
};

/** Arrow suffix nudges right on hover (group set on the anchor). */
function Suffix({ variant }: { variant: MonoLinkVariant }) {
  return (
    <>
      {" "}
      <span
        aria-hidden
        className="inline-block transition-transform duration-150 group-hover:translate-x-0.5"
      >
        {SUFFIX[variant]}
      </span>
    </>
  );
}

export function MonoLink({
  href,
  variant,
  className,
  children,
  contact,
}: MonoLinkProps) {
  const classes = cn(
    "group font-mono text-xs no-underline transition-colors duration-150 hover:text-rubric hover:underline",
    className
  );

  const onClick = contact
    ? () => track("contact_click", { target: contact })
    : undefined;

  if (variant === "internal") {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
        <Suffix variant="internal" />
      </Link>
    );
  }

  if (variant === "external") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        onClick={onClick}
      >
        {children}
        <Suffix variant="external" />
      </a>
    );
  }

  // mailto — plain anchor; ↗ suffix to match sibling contact links
  // (owner override of the 00-decisions §8 no-suffix default, 2026-07-03).
  return (
    <a href={href} className={classes} onClick={onClick}>
      {children}
      <Suffix variant="mailto" />
    </a>
  );
}
