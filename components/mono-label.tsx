import { cn } from "@/lib/utils";

export function MonoLabel({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("font-mono text-xs text-muted", className)}
      {...props}
    >
      {children}
    </span>
  );
}
