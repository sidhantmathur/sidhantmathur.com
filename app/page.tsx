import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { MonoLabel } from "@/components/mono-label";

export default function Home() {
  return (
    <Section divider="none" className="flex-1">
      <Container className="py-16">
        <MonoLabel>Status</MonoLabel>
        <h1 className="mt-2 font-mono text-2xl tracking-tight">
          Phase 1 scaffold
        </h1>
      </Container>
    </Section>
  );
}
