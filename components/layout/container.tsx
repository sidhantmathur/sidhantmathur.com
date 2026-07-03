import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto max-w-[1200px] px-6 md:px-12", className)}
      {...props}
    >
      {children}
    </div>
  );
}
