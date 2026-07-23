import { cn } from "@/lib/utils";

type ProjectCardProps = React.ComponentProps<"div"> & {
  /** Corner badge number, e.g. "01". */
  index: string;
};

export function ProjectCard({
  index,
  className,
  children,
  ...props
}: ProjectCardProps) {
  return (
    <div
      className={cn(
        "group relative border border-ink transition-colors duration-150 hover:bg-surface",
        className
      )}
      {...props}
    >
      <span className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center bg-rubric font-mono text-[11px] text-paper">
        {index}
      </span>

      <div className="min-h-24">{children}</div>
    </div>
  );
}
