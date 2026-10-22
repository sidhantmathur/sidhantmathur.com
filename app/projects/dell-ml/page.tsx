import type { Metadata } from "next";
import { CaseStudyLayout } from "@/components/case-study-layout";
import CaseStudy from "@/content/dell-ml.mdx";

export const metadata: Metadata = {
  alternates: { canonical: "/projects/dell-ml" },
  title: "Sales prediction model at Dell",
  description:
    "A propensity model that ranked accounts for cross-sell, built during a 2018 internship.",
};

export default function DellMlPage() {
  return (
    <CaseStudyLayout
      slug="dell-ml"
      title="Sales prediction model at Dell"
      subtitle="A propensity model that ranked accounts for cross-sell, built during a 2018 internship."
    >
      <CaseStudy />
    </CaseStudyLayout>
  );
}
