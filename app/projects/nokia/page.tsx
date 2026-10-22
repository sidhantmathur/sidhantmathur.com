import type { Metadata } from "next";
import { CaseStudyLayout } from "@/components/case-study-layout";
import CaseStudy from "@/content/nokia.mdx";

export const metadata: Metadata = {
  alternates: { canonical: "/projects/nokia" },
  title: "Reporting tools at Nokia",
  description:
    "I eliminated a manual quarter-end reporting process and moved sales reporting for 150+ users onto a data model I own.",
};

export default function NokiaPage() {
  return (
    <CaseStudyLayout
      slug="nokia"
      title="Reporting tools at Nokia"
      subtitle="I eliminated a manual quarter-end reporting process and moved sales reporting for 150+ users onto a data model I own."
    >
      <CaseStudy />
    </CaseStudyLayout>
  );
}
