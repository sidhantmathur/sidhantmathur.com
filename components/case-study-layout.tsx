import { DocPage } from "@/components/layout/doc-page";

type CaseStudyLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function CaseStudyLayout({ title, subtitle, children }: CaseStudyLayoutProps) {
  return (
    <DocPage>
      <h1 className="text-[24px] font-medium tracking-[-0.02em] text-text">{title}</h1>
      <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-text-soft">
        {subtitle}
      </p>
      <div className="mt-10">{children}</div>
    </DocPage>
  );
}
