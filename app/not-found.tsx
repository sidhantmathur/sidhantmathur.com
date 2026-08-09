import Link from "next/link";

// Rendered inside the root layout, which is now the dark app shell's document.
// It carries its own full-height wrapper because the root body is overflow-hidden.
export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-start justify-center gap-4 bg-bg px-6 [font-family:var(--font-geist-mono)] md:px-12">
      <p className="t-body text-text-soft">There&apos;s nothing at this address.</p>
      <Link
        href="/"
        className="t-meta inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2 text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
      >
        Head back home →
      </Link>
    </div>
  );
}
