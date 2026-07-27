import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

// TRANSITIONAL — delete this route group in phase 4.
//
// The root layout is now the dark app shell's chrome. These routes (/resume,
// /projects/*, /colophon) still render against the legacy paper/ink tokens, so
// they get their own light wrapper and keep the old header/footer until they're
// restyled. A route group adds no path segment: the URLs are unchanged.
//
// When phase 4 restyles these pages against the dark tokens, move them back to
// app/ and delete this file, components/layout/header.tsx, and
// components/layout/footer.tsx along with it.
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  // h-dvh + overflow-y-auto, not min-h-dvh: the root body is overflow-hidden
  // for the app shell, so these pages need their own scroll container.
  return (
    <div className="flex h-dvh flex-col overflow-y-auto bg-paper text-ink [color-scheme:light]">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
