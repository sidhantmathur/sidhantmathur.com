import { DocPage } from "@/components/layout/doc-page";

type CaseStudyLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function CaseStudyLayout({ title, subtitle, children }: CaseStudyLayoutProps) {
  return (
    <DocPage>
      <h1 className="t-title font-medium text-text">{title}</h1>
      <p className="t-body mt-3 max-w-[62ch] text-text-soft">{subtitle}</p>
      <div className="mt-10">{children}</div>
    </DocPage>
  );
}
