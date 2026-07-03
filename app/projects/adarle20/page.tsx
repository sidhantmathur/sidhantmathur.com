import type { Metadata } from "next";
import { CaseStudyLayout } from "@/components/case-study-layout";
import CaseStudy from "@/content/adarle20.mdx";

export const metadata: Metadata = {
  title: "A Darle 20",
  description: "A marketplace for tabletop game sessions in Latin America.",
};

export default function AdarleTwentyPage() {
  return (
    <CaseStudyLayout
      title="A Darle 20"
      subtitle="A marketplace for tabletop game sessions in Latin America."
    >
      <CaseStudy />
    </CaseStudyLayout>
  );
}
