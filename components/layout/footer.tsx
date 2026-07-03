import { MonoLink } from "@/components/mono-link";

export function Footer() {
  return (
    <footer className="flex items-center justify-between border-t border-hairline px-10 py-3.5 font-mono text-[11px] text-faint">
      <span>© 2026 Sidhant Mathur · Toronto, ON</span>
      <span className="flex items-center gap-4">
        <MonoLink href="https://github.com/sidhantmathur" variant="external">
          GitHub
        </MonoLink>
        <MonoLink
          href="https://www.linkedin.com/in/sidhantmathur"
          variant="external"
        >
          LinkedIn
        </MonoLink>
        <MonoLink href="mailto:sidhant185@gmail.com" variant="mailto">
          Email
        </MonoLink>
      </span>
    </footer>
  );
}
