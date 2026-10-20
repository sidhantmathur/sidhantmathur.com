import { cn } from "@/lib/utils";

export function MonoLabel({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      // A section marker a reader scans the document by, so it takes the meta
      // tier in text-soft rather than the label tier in faint.
      className={cn("font-mono t-meta tracking-widest text-text-soft", className)}
      {...props}
    >
      {children}
    </span>
  );
}
