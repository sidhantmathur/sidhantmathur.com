import { MonoLink } from "@/components/mono-link";

export function Footer() {
  return (
    <footer className="flex flex-col gap-2 border-t border-hairline px-10 py-3.5 font-mono text-[11px] text-muted md:flex-row md:items-center md:justify-between">
      <span>© 2026 Sidhant Mathur · Toronto, ON</span>
      <span className="flex items-center gap-4">
        <MonoLink
          href="https://github.com/sidhantmathur"
          variant="external"
          contact="github"
        >
          GitHub
        </MonoLink>
        <MonoLink
          href="https://www.linkedin.com/in/sidhantmathur"
          variant="external"
          contact="linkedin"
        >
          LinkedIn
        </MonoLink>
        <MonoLink
          href="mailto:hello@sidhantmathur.com"
          variant="mailto"
          contact="email"
        >
          Email
        </MonoLink>
      </span>
    </footer>
  );
}
