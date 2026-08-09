import { cn } from "@/lib/utils";

export function MonoLabel({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      // A section marker, not a footnote. text-xs put it at 12px in the
      // faintest colour on the page, which made the one landmark a reader
      // scans a document by the hardest thing on it to see.
      className={cn("font-mono text-[13px] tracking-widest text-text-soft", className)}
      {...props}
    >
      {children}
    </span>
  );
}
