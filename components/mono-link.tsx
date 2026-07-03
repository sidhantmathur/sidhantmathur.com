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
  internal: " →",
  external: " ↗",
  mailto: "",
};

export function MonoLink({
  href,
  variant,
  className,
  children,
  contact,
}: MonoLinkProps) {
  const classes = cn(
    "font-mono text-xs no-underline hover:underline",
    className
  );

  const onClick = contact
    ? () => track("contact_click", { target: contact })
    : undefined;

  if (variant === "internal") {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
        {SUFFIX.internal}
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
        {SUFFIX.external}
      </a>
    );
  }

  // mailto — plain anchor, no suffix (00-decisions §8, flagged convention).
  return (
    <a href={href} className={classes} onClick={onClick}>
      {children}
    </a>
  );
}
