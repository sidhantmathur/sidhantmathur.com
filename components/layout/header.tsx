import Link from "next/link";

// TRANSITIONAL — used only by app/(legacy)/layout.tsx; deleted in phase 4.
// The command-palette trigger that used to live here is gone: the palette was
// mounted by the old root layout, and the app shell replaced it with slash
// commands in the chat input.
export function Header() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-ink bg-paper px-10 py-3.5 font-mono text-xs">
      <Link href="/" className="no-underline hover:underline">
        Sidhant Mathur
      </Link>
      <Link href="/" className="no-underline hover:underline">
        Ask me anything →
      </Link>
    </header>
  );
}
