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
    "A marketplace for tabletop game sessions in Latin America — 2,100+ bookings in its first four months.",
};

export default function AdarleTwentyPage() {
  return (
    <CaseStudyLayout
      title="A Darle 20"
      subtitle="A marketplace for tabletop game sessions in Latin America."
    >
      <CaseStudy />
      {/* #19 — the feature surface and the media frames. Both are appended
          below the approved case-study prose rather than woven into it: the
          MDX is site copy from docs/site-copy.md and this track adds layers
          above and below it without editing a word. */}
      <AdarleFeatureSurface />
      <AdarleMediaSurface />
    </CaseStudyLayout>
  );
}
