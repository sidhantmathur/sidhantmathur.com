import type { Metadata } from "next";
import { CaseStudyLayout } from "@/components/case-study-layout";
import CaseStudy from "@/content/nokia.mdx";

export const metadata: Metadata = {
  title: "Reporting tools at Nokia",
  description: "Internal tools for a global sales organization.",
};

export default function NokiaPage() {
  return (
    <CaseStudyLayout
      title="Reporting tools at Nokia"
      subtitle="Internal tools for a global sales organization."
    >
      <CaseStudy />
    </CaseStudyLayout>
  );
}
