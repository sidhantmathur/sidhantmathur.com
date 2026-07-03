import { cn } from "@/lib/utils";

type ProjectCardProps = React.ComponentProps<"div"> & {
  /** Corner badge number, e.g. "01". */
  index: string;
};

const METADATA_LABELS = ["Role", "Stack", "Status", "Link"] as const;

export function ProjectCard({
  index,
  className,
  children,
  ...props
}: ProjectCardProps) {
  return (
    <div
      className={cn("relative border border-ink", className)}
      {...props}
    >
      <span className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center bg-ink font-mono text-[11px] text-paper">
        {index}
      </span>

      <div className="min-h-24">{children}</div>

      <div className="grid grid-cols-4 border-t border-ink">
        {METADATA_LABELS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "px-3 py-2 font-mono text-xs",
              i > 0 && "border-l border-hairline"
            )}
          >
            <span className="text-faint">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
