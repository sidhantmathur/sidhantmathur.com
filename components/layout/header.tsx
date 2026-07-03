import { MonoLink } from "@/components/mono-link";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-ink px-10 py-3.5 font-mono text-xs">
      <span>Sidhant Mathur</span>
      <span className="text-ink-soft">Toronto, ON · Open to new roles</span>
      <MonoLink href="mailto:sidhant185@gmail.com" variant="mailto">
        Email
      </MonoLink>
    </header>
  );
}
