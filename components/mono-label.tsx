import { cn } from "@/lib/utils";

export function MonoLabel({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      // A section marker a reader scans the document by, so it is 13px in
      // text-soft rather than small and faint.
      className={cn("font-mono text-[13px] tracking-widest text-text-soft", className)}
      {...props}
    >
      {children}
    </span>
  );
}
