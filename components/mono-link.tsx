import Link from "next/link";
import { cn } from "@/lib/utils";

type MonoLinkVariant = "internal" | "external" | "mailto";

type MonoLinkProps = {
  href: string;
  variant: MonoLinkVariant;
  className?: string;
  children: React.ReactNode;
};

const SUFFIX: Record<MonoLinkVariant, string> = {
  internal: " →",
  external: " ↗",
  mailto: "",
};

export function MonoLink({ href, variant, className, children }: MonoLinkProps) {
  const classes = cn(
    "font-mono text-xs no-underline hover:underline",
    className
  );

  if (variant === "internal") {
    return (
      <Link href={href} className={classes}>
        {children}
        {SUFFIX.internal}
      </Link>
    );
  }

  if (variant === "external") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
        {SUFFIX.external}
      </a>
    );
  }

  // mailto — plain anchor, no suffix (00-decisions §8, flagged convention).
  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}
