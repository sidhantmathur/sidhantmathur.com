import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Chat variant of the homepage project card (04 §2.1). Reuses the Phase 2
// card pattern at a smaller scale: 1px ink border, numbered corner badge, a
// 4-column mono metadata strip along the bottom. The image column renders only
// for A Darle 20 (the only project with an image).
//
// Shape matches the showProject tool's execute() return value.
export type ProjectCardData = {
  slug: string;
  index: string;
  title: string;
  description: string;
  role: string;
  stack: string[];
  status: string;
  caseStudyHref: string;
  image: string | null;
};

export function ProjectCard({ data }: { data: ProjectCardData }) {
  const hasImage = !!data.image;

  return (
    <div className="relative border border-ink bg-paper">
      <span className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center bg-ink font-mono text-[11px] text-paper">
        {data.index}
      </span>

      <div
        className={cn(
          "grid grid-cols-1",
          hasImage && "md:grid-cols-[1fr_minmax(280px,420px)]",
        )}
      >
        <div className="p-5">
          <h3 className="font-sans text-[20px] font-semibold tracking-[-0.025em] text-ink">
            {data.title}
          </h3>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
            {data.description}
          </p>
        </div>
        {hasImage && (
          <div className="relative min-h-[180px] border-t border-ink md:border-l md:border-t-0">
            <Image
              src={data.image!}
              alt={`${data.title} screenshot`}
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              className="object-cover"
              style={{ filter: "grayscale(0.15)" }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 border-t border-ink md:grid-cols-4">
        <MetaCell label="Role" value={data.role} />
        <MetaCell label="Stack" value={data.stack.join(", ")} />
        <MetaCell label="Status" value={data.status} />
        <div className="border-l border-hairline px-3 py-2 font-mono text-xs">
          <span className="text-faint">Link</span>
          <div className="mt-0.5">
            <Link
              href={data.caseStudyHref}
              className="text-ink no-underline hover:underline"
            >
              Read the case study →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-hairline px-3 py-2 font-mono text-xs first:border-l-0">
      <span className="text-faint">{label}</span>
      <div className="mt-0.5 text-ink-soft">{value}</div>
    </div>
  );
}
