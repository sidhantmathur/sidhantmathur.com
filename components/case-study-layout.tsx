import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";

type CaseStudyLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function CaseStudyLayout({
  title,
  subtitle,
  children,
}: CaseStudyLayoutProps) {
  return (
    <Section divider="none">
      <Container className="py-16">
        <Link
          href="/"
          className="inline-block font-mono text-xs text-ink-soft no-underline hover:underline"
        >
          ← Selected work
        </Link>
        <h1 className="mt-6 font-sans text-[30px] font-semibold tracking-[-0.025em] text-ink">
          {title}
        </h1>
        <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft md:text-base">
          {subtitle}
        </p>
        <div className="mt-10">{children}</div>
      </Container>
    </Section>
  );
}
