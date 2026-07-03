import { cn } from "@/lib/utils";

type SectionProps = React.ComponentProps<"section"> & {
  /** Divider along the top of the section. Defaults to a hairline rule. */
  divider?: "hairline" | "ink" | "none";
};

export function Section({
  className,
  divider = "hairline",
  children,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        divider === "hairline" && "border-t border-hairline",
        divider === "ink" && "border-t border-ink",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}
