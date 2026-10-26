import type { Metadata } from "next";
import { CaseStudyLayout } from "@/components/case-study-layout";
import CaseStudy from "@/content/dell-ml.mdx";

export const metadata: Metadata = {
  alternates: { canonical: "/projects/dell-ml" },
  title: "Sales prediction model at Dell",
  description:
    "An Azure ML propensity model that found cross-sell accounts, built during a 2018 internship.",
};

export default function DellMlPage() {
  return (
    <CaseStudyLayout
      slug="dell-ml"
      title="Sales prediction model at Dell"
      subtitle="An Azure ML propensity model that found cross-sell accounts, built during a 2018 internship."
    >
      <CaseStudy />
    </CaseStudyLayout>
  );
}
