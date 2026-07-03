import type { Metadata } from "next";
import { CaseStudyLayout } from "@/components/case-study-layout";
import CaseStudy from "@/content/dell-ml.mdx";

export const metadata: Metadata = {
  title: "Sales prediction at Dell",
  description:
    "A machine learning model for lead targeting, built as an intern.",
};

export default function DellMlPage() {
  return (
    <CaseStudyLayout
      title="Sales prediction at Dell"
      subtitle="A machine learning model for lead targeting, built as an intern."
    >
      <CaseStudy />
    </CaseStudyLayout>
  );
}
