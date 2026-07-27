import Link from "next/link";

// Chrome for the document-style routes — /resume, /projects/*, /colophon.
//
// These pages are deliberately still real, server-rendered, crawlable routes:
// search engines index them, they can be pasted into an application, and they
// work with JS off. What they no longer have is a site header and footer — the
// app shell is the navigation, so the only chrome here is the way back to it.
//
// The wrapper owns its own scroll container because the root body is
// overflow-hidden for the shell.
//
// PHASE 4 renders these same page bodies inside the shell's context panel via
// intercepting routes. Keep the content free of fixed widths and viewport
// units so it reflows into a ~380px column without changes.
export function DocPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh overflow-y-auto bg-bg text-text [font-family:var(--font-geist-mono)]">
      <header className="sticky top-0 z-10 flex h-9 items-center border-b border-line bg-panel px-4 text-[11px] md:px-6">
        <Link
          href="/"
          className="text-text-soft no-underline transition-colors hover:text-accent"
        >
          ← Back to the conversation
        </Link>
      </header>
      <main className="mx-auto max-w-[80ch] px-4 py-10 md:px-6">{children}</main>
    </div>
  );
}
