import type { Metadata } from "next";
import { CaseStudyLayout } from "@/components/case-study-layout";
import CaseStudy from "@/content/dell-ml.mdx";

export const metadata: Metadata = {
  title: "Sales prediction at Dell",
  description:
    "A propensity model for cross-sell targeting, built as an intern.",
};

export default function DellMlPage() {
  return (
    <CaseStudyLayout
      title="Sales prediction at Dell"
      subtitle="A propensity model for cross-sell targeting, built as an intern."
    >
      <CaseStudy />
    </CaseStudyLayout>
  );
}
