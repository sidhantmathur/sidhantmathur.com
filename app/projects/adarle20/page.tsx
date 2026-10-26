import type { Metadata } from "next";
import { CaseStudyLayout } from "@/components/case-study-layout";
import {
  AdarleFeatureSurface,
  AdarleMediaSurface,
} from "@/components/project-media";
import CaseStudy from "@/content/adarle20.mdx";

export const metadata: Metadata = {
  alternates: { canonical: "/projects/adarle20" },
  title: "A Darle 20",
  description:
    "A marketplace I co-founded and built as its sole developer, part-time: 2,100+ users, 110+ hosts and 3,600+ session reservations since its March 2026 launch.",
};

export default function AdarleTwentyPage() {
  return (
    <CaseStudyLayout
      slug="adarle20"
      title="A Darle 20"
      subtitle="A marketplace for tabletop game sessions, based in Puebla, Mexico. I'm co-founder and CTO, part-time, and its sole developer."
    >
      <CaseStudy />
      {/* #19 — the media frames and the feature surface, appended below the
          case-study prose rather than woven into it, so the MDX stays plain
          site copy from docs/site-copy.md. The screenshot comes first: it is
          proof; the feature list is an index of what the prose already says. */}
      <AdarleMediaSurface />
      <AdarleFeatureSurface />
    </CaseStudyLayout>
  );
}
