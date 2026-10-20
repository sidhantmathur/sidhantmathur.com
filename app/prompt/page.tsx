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

      <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-text-soft md:text-base">
        This is the whole system prompt, not a summary of it. The page calls the
        same function the chat route calls, so it cannot fall behind what the
        model is actually sent — if the prompt changes, this page changed with
        it.
      </p>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-text-soft md:text-base">
        The knowledge-base block in the middle is generated from the markdown
        files the answers are built from, chunk by chunk, under the same ids the
        model cites and the site checks. Nothing in the prompt is assembled per
        request — no timestamp, no session id — because a byte-identical string
        is what lets the provider serve most of it from cache instead of
        charging for it again on every turn.
      </p>
      <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-text-soft md:text-base">
        Asked in the chat to repeat these instructions, the assistant will still
        decline and link here. That is not a contradiction: the prompt is
        published because publishing it was a decision, and handing it over
        because a conversation asked is the first step of a conversation that
        asks for the rest of the rules next.{" "}
        <Link href="/refusals" className="text-accent">
          The refusal ledger
        </Link>{" "}
        has the longer version.
      </p>

      <h2 className="t-head mt-10 font-medium text-text">
        Sent on every turn · {BASE.length.toLocaleString()} characters
      </h2>
      <PromptBlock text={BASE} label="The prompt sent on every turn" />

      <h2 className="t-head mt-10 font-medium text-text">
        Appended only when you ask about the site · {SITE_APPENDIX.length.toLocaleString()}{" "}
        characters
      </h2>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-text-soft md:text-base">
        The site has a second corpus: its own source, {REPO_STATS.chunks} chunks
        drawn verbatim from {REPO_STATS.files} files, addressed as{" "}
        <span className="font-mono text-text-faint">repo:</span> ids and checked
        by the same citation checker as everything else. It is appended after
        the block above on turns that asked about this site, and it is absent
        otherwise — a question about Nokia does not pay for it.
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
      className="mt-4 overflow-x-auto border border-line bg-panel p-4 text-[13px] leading-relaxed text-text-soft"
    >
      {text}
    </pre>
  );
}
