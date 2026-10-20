import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/layout/doc-page";
import { buildSystemPrompt, SITE_APPENDIX } from "@/lib/system-prompt";
import { REPO_STATS } from "@/lib/repo.generated";

// The published system prompt (#7). It renders `buildSystemPrompt()`, the
// function the chat route calls, rather than a copy of the text, so it can't
// drift from what the model is sent.
//
// Safe to pre-render because the prompt has no per-request content by design;
// that is also what lets the provider cache it.

export const metadata: Metadata = {
  alternates: { canonical: "/prompt" },
  title: "The instructions this assistant was given",
  description:
    "The full system prompt behind the chat on this site, rendered from the same function the chat route calls.",
};

const BASE = buildSystemPrompt();

export default function PromptPage() {
  return (
    <DocPage>
      <h1 className="t-title font-medium text-text">
        The instructions this assistant was given
      </h1>

      <p className="mt-6 max-w-[62ch] t-body text-text-soft">
        This is the full system prompt the chat runs on. The page renders it
        with the same function the chat route calls, so it always matches what
        the model is sent.
      </p>
      <p className="mt-4 max-w-[62ch] t-body text-text-soft">
        The knowledge-base block in the middle is generated from the markdown
        files the answers are built from, chunk by chunk, under the same ids the
        model cites and the site checks. The prompt has no timestamp, session id
        or anything else that changes per request. Keeping it identical lets the
        provider serve most of it from cache, which is cheaper than processing
        it from scratch on every turn.
      </p>
      <p className="mt-4 max-w-[62ch] t-body text-text-soft">
        Ask the assistant to recite these instructions and it will decline and
        link here, even though the prompt isn&apos;t a secret. If a
        conversation gets it to break one rule, the others get easier to break,
        so it&apos;s told to decline every time. The page on{" "}
        <Link href="/refusals" className="text-accent">
          what it won&apos;t do
        </Link>{" "}
        has more on why.
      </p>

      <h2 className="t-head mt-10 font-medium text-text">
        Sent on every turn · {BASE.length.toLocaleString()} characters
      </h2>
      <PromptBlock text={BASE} label="The prompt sent on every turn" />

      <h2 className="t-head mt-10 font-medium text-text">
        Appended only when you ask about the site · {SITE_APPENDIX.length.toLocaleString()}{" "}
        characters
      </h2>
      <p className="mt-3 max-w-[62ch] t-body text-text-soft">
        The site&apos;s own source is a second corpus, {REPO_STATS.chunks} chunks
        drawn verbatim from {REPO_STATS.files} files. They&apos;re cited by{" "}
        <span className="font-mono text-text-faint">repo:</span> ids and checked
        by the same citation checker as everything else. The corpus is appended
        after the block above only on turns that ask about the site, so a
        question about Nokia doesn&apos;t pay for it.
      </p>
      <PromptBlock text={SITE_APPENDIX} label="The appendix added when you ask about the site" />
    </DocPage>
  );
}

function PromptBlock({ text, label }: { text: string; label: string }) {
  return (
    // Chrome makes any scrollable box a tab stop so the arrow keys can scroll
    // it, and an unnamed stop announces nothing. `role="region"` plus a label
    // names it; tabIndex is explicit so the behaviour doesn't depend on whether
    // the block overflows at a given width.
    <pre
      role="region"
      aria-label={label}
      tabIndex={0}
      className="mt-4 overflow-x-auto border border-line bg-panel p-4 t-meta text-text-soft"
    >
      {text}
    </pre>
  );
}
