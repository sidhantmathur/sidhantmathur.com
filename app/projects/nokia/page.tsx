import type { Metadata } from "next";
import { CaseStudyLayout } from "@/components/case-study-layout";
import CaseStudy from "@/content/nokia.mdx";

export const metadata: Metadata = {
  alternates: { canonical: "/projects/nokia" },
  title: "Reporting and tooling at Nokia",
  description:
    "I build and run the tools a 7-region sales organization reports on, and keep alive the ones I inherited.",
};

export default function NokiaPage() {
  return (
    <CaseStudyLayout
      slug="nokia"
      title="Reporting and tooling at Nokia"
      subtitle="I build and run the tools a 7-region sales organization reports on, and keep alive the ones I inherited. Before that, I ran the monthly headcount forecast."
    >
      <CaseStudy />
    </CaseStudyLayout>
  );
}
