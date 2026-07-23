import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { MonoLabel } from "@/components/mono-label";
import { MonoLink } from "@/components/mono-link";
import { ProjectCard } from "@/components/project-card";
import { AskAnythingButton } from "@/components/ask-anything-button";
import { PROJECTS } from "@/content/projects";

const EXPERIENCE_ROWS = [
  {
    date: "2025 —",
    name: "A Darle 20",
    role: "Co-Founder & CTO",
    link: { label: "details", href: "/projects/adarle20" },
  },
  {
    date: "2022 —",
    name: "Nokia",
    role: "Sales operations",
    link: { label: "details", href: "/projects/nokia" },
  },
  {
    date: "2019–2022",
    name: "Freelance web development",
    role: "Self-employed",
    link: null,
  },
  {
    date: "2018",
    name: "Dell",
    role: "Marketing intern",
    link: { label: "details", href: "/projects/dell-ml" },
  },
  {
    date: "full history",
    name: "Everything else, in one page",
    role: "",
    link: { label: "resume", href: "/resume" },
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <Section divider="none">
        <Container className="py-16 md:py-24">
          <h1 className="max-w-[22ch] font-mono text-[clamp(32px,5vw,58px)] font-medium leading-[1.12] tracking-[-0.015em] text-ink">
            I build internal tools, revenue systems, and the occasional{" "}
            <span className="bg-rubric px-[0.14em] text-paper [box-decoration-break:clone]">
              whole product
            </span>
            .
          </h1>
          <p className="mt-6 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft md:text-base">
            I work in sales operations at Nokia, where tools I&apos;ve built are used by 150+
            people across seven regions. On the side I founded A Darle 20, a live marketplace
            processing real payments in Latin America.
          </p>
          <p className="mt-6 font-mono text-xs text-muted">
            Sidhant Mathur · Toronto, ON · Open to new roles
          </p>
          <div className="mt-8 flex items-center gap-6">
            <AskAnythingButton />
            <MonoLink href="/resume" variant="internal">
              View resume
            </MonoLink>
          </div>
        </Container>
      </Section>

      {/* Selected work */}
      <Section>
        <Container className="py-16">
          <MonoLabel>Selected work</MonoLabel>

          <div className="mt-6 flex flex-col gap-8">
            {/* A Darle 20 — the only card with an image column. */}
            <ProjectCard index={PROJECTS.adarle20.index}>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(280px,420px)]">
                <div className="p-6">
                  <h2 className="font-sans text-[30px] font-semibold tracking-[-0.025em] text-ink">
                    {PROJECTS.adarle20.title}
                  </h2>
                  <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
                    {PROJECTS.adarle20.description}
                  </p>
                </div>
                <div className="relative min-h-[220px] border-t border-ink md:border-l md:border-t-0">
                  <Image
                    src={PROJECTS.adarle20.image!}
                    alt="A Darle 20 listings screenshot"
                    fill
                    className="object-cover grayscale-[0.15] transition-[filter] duration-300 group-hover:grayscale-0"
                  />
                </div>
              </div>
              <CardMetaStrip
                role={PROJECTS.adarle20.role}
                stack={PROJECTS.adarle20.stack.join(", ")}
                status={PROJECTS.adarle20.status}
                href={PROJECTS.adarle20.caseStudyHref}
              />
            </ProjectCard>

            {/* Nokia and Dell — no image exists for either, so the visual
                column renders the project's headline stat as display type. */}
            {[
              {
                project: PROJECTS.nokia,
                stat: { value: "150+", label: "users across seven regions" },
              },
              {
                project: PROJECTS["dell-ml"],
                stat: { value: "$129M", label: "estimated pipeline" },
              },
            ].map(({ project, stat }) => (
              <ProjectCard key={project.slug} index={project.index}>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(280px,420px)]">
                  <div className="p-6">
                    <h2 className="font-sans text-[30px] font-semibold tracking-[-0.025em] text-ink">
                      {project.title}
                    </h2>
                    <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
                      {project.description}
                    </p>
                  </div>
                  <div className="flex flex-col justify-center gap-1.5 border-t border-ink p-6 md:border-l md:border-t-0">
                    <span className="font-mono text-[clamp(44px,5vw,68px)] font-medium leading-none tracking-[-0.02em] text-ink">
                      {stat.value}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {stat.label}
                    </span>
                  </div>
                </div>
                <CardMetaStrip
                  role={project.role}
                  stack={project.stack.join(", ")}
                  status={project.status}
                  href={project.caseStudyHref}
                />
              </ProjectCard>
            ))}
          </div>
        </Container>
      </Section>

      {/* Chat teaser */}
      <Section>
        <Container className="py-16">
          <h2 className="font-sans text-[30px] font-semibold tracking-[-0.025em] text-ink">
            Ask about my work
          </h2>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
            I built a small assistant into this site. It knows my background and
            projects, and it can answer the questions a resume can&apos;t — or just show you
            around. It&apos;s also a working demo of how I build with LLMs.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              "What did Sidhant build at Nokia?",
              "How does A Darle 20 work?",
              "Is he a fit for a solutions engineering role?",
            ].map((q) => (
              <Link
                key={q}
                href={`/chat?q=${encodeURIComponent(q)}`}
                className="border border-hairline px-3 py-1.5 font-mono text-xs text-ink-soft transition-colors duration-150 hover:border-rubric hover:text-ink"
              >
                {q}
              </Link>
            ))}
          </div>

          <p className="mt-4 font-mono text-xs text-muted">
            AI-generated answers about my professional background.
            It can make mistakes — the resume is the authoritative version.
          </p>
        </Container>
      </Section>

      {/* About */}
      <Section>
        <Container className="py-16">
          <MonoLabel>About</MonoLabel>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
            I&apos;m a sales operations specialist at Nokia in Toronto and the co-founder
            and CTO of A Darle 20. I don&apos;t have a computer science degree — I have a
            business degree, a bootcamp, and eight years of teaching myself whatever the
            next problem required: React, SQL, the Power Platform, Stripe, and lately,
            building with LLMs and coding agents.
          </p>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
            The through line is that I like turning vague business problems into working
            software, and I like owning the result — support, bugs, and all.
          </p>
          <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-ink-soft">
            Outside work: basketball, chess, cooking, and slowly learning three languages.
          </p>
        </Container>
      </Section>

      {/* Experience table */}
      <Section>
        <Container className="py-16">
          <MonoLabel>Experience</MonoLabel>
          <div className="mt-6 border-t border-ink">
            {EXPERIENCE_ROWS.map((row, i) => (
              <div
                key={row.name}
                className={`grid grid-cols-[100px_1fr_130px] items-baseline gap-4 py-4 md:grid-cols-[140px_1fr_1fr_130px] ${
                  i < EXPERIENCE_ROWS.length - 1 ? "border-b border-hairline" : ""
                }`}
              >
                <span className="font-mono text-xs text-muted">{row.date}</span>
                <span className="text-[15px] text-ink">{row.name}</span>
                <span className="hidden text-[15px] text-ink-soft md:block">{row.role}</span>
                <span className="text-right">
                  {row.link ? (
                    <MonoLink href={row.link.href} variant="internal">
                      {row.link.label}
                    </MonoLink>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}

function CardMetaStrip({
  role,
  stack,
  status,
  href,
}: {
  role: string;
  stack: string;
  status: string;
  href: string;
}) {
  return (
    <div className="grid grid-cols-2 border-t border-ink md:grid-cols-4">
      <MetaCell label="Role" value={role} />
      <MetaCell label="Stack" value={stack} />
      <MetaCell label="Status" value={status} />
      <div className="border-l border-hairline px-3 py-2 font-mono text-xs">
        <span className="text-muted">Link</span>
        <div className="mt-0.5">
          <Link
            href={href}
            className="group/link no-underline transition-colors duration-150 hover:text-rubric hover:underline"
          >
            Read the case study{" "}
            <span
              aria-hidden
              className="inline-block transition-transform duration-150 group-hover/link:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-hairline px-3 py-2 font-mono text-xs first:border-l-0">
      <span className="text-muted">{label}</span>
      <div className="mt-0.5 text-ink-soft">{value}</div>
    </div>
  );
}
