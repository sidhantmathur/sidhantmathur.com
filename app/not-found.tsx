import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";

export default function NotFound() {
  return (
    <Section divider="none" className="flex-1">
      <Container className="py-24">
        <p className="text-[15px] leading-relaxed text-ink-soft md:text-base">
          There&apos;s nothing at this address.{" "}
          <Link
            href="/"
            className="font-mono text-[13px] text-ink no-underline hover:underline"
          >
            Head back home →
          </Link>
        </p>
      </Container>
    </Section>
  );
}
