import { Suspense } from "react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { ChatConversation } from "./chat-conversation";

// Copy strings — verbatim from docs/site-copy.md.
const EMPTY_STATE =
  "Ask me about my work at Nokia, A Darle 20, or anything on my resume.";
const DISCLAIMER =
  "AI-generated answers about my professional background. It can make mistakes — the resume is the authoritative version.";
const SUGGESTED = [
  "What did Sidhant build at Nokia?",
  "How does A Darle 20 work?",
  "Is he a fit for a solutions engineering role?",
];

// Static fallback that mirrors ChatConversation's empty state exactly (same
// classes) so the first paint — server-rendered, no JS required — already
// contains the real page chrome: empty-state copy, suggested-question chips
// (non-interactive here), and the fixed dark input bar. The client component
// mounts over this and takes over seamlessly once hydrated, with no visible
// flicker since the markup matches.
function ChatFallback() {
  return (
    <>
      <div className="mt-8 space-y-6">
        <p className="max-w-[58ch] font-mono text-[13px] leading-relaxed text-muted">
          {EMPTY_STATE}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {SUGGESTED.map((q) => (
          <span
            key={q}
            className="border border-hairline px-3 py-1.5 font-mono text-xs text-ink-soft"
          >
            {q}
          </span>
        ))}
      </div>

      <form className="fixed inset-x-0 bottom-0 z-50 border-t border-ink bg-ink px-6 md:px-12">
        <div className="flex h-11 items-center font-mono text-[13px]">
          <span className="text-band-muted">&gt;</span>
          <input
            type="text"
            disabled
            placeholder="Ask a question about my work"
            className="ml-2 w-full flex-1 border-none bg-transparent text-paper outline-none placeholder:text-band-muted"
          />
          <span className="text-band-muted">enter ↵</span>
        </div>
      </form>
    </>
  );
}

export default function ChatPage() {
  // useSearchParams (inside ChatConversation) must be wrapped in Suspense so
  // /chat stays a static shell (Next.js requirement). The fallback below
  // renders the same chrome as the hydrated empty state, so LCP paints from
  // prerendered HTML instead of waiting on client JS.
  //
  // Layout: the conversation lives in normal page flow; the input is a fixed
  // bar at the viewport bottom (same position/style as the site-wide launcher
  // bar, hidden on this route). pb-28 keeps the last message clear of it.
  return (
    <Section divider="none">
      <Container className="pb-28 pt-16">
        <h1 className="font-sans text-[30px] font-semibold tracking-[-0.025em] text-ink">
          Ask about my work
        </h1>

        <p className="mt-3 max-w-[58ch] font-mono text-xs text-muted">
          {DISCLAIMER}
        </p>

        <Suspense fallback={<ChatFallback />}>
          <ChatConversation />
        </Suspense>
      </Container>
    </Section>
  );
}
