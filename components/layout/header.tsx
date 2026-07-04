import Link from "next/link";
import { CommandPaletteTrigger } from "@/components/command-palette-trigger";

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-ink bg-paper px-10 py-3.5 font-mono text-xs">
      <Link href="/" className="no-underline hover:underline">
        Sidhant Mathur
      </Link>
      <CommandPaletteTrigger />
    </header>
  );
}
