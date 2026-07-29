"use client";

import { useCallback, useEffect, useState } from "react";
import {
  conversationToMarkdown,
  latestRoleFit,
  mailtoHref,
  scorecardMarkdown,
  verdictCounts,
} from "@/lib/transcript";
import { PERMALINK_SAFE_CHARS, permalinkFor, permalinkSupported } from "@/lib/permalink";
import { track } from "@/lib/analytics";
import { CopyButton } from "./copy-button";
import { FIT_LABELS } from "./shell-data";
import type { ChatMessage } from "./use-conversation";

// The one export surface (roadmap Sprint 5, #17 + #24 + bank §6 Stage 3).
//
// Sidhant's own consolidation of five ideas: "export this chat and maybe a
// bunch of different options — markdown, PDF, print, all that stuff. Maybe
// that's one way to simplify all these ideas." So this is ONE panel view with
// four handles on the same conversation, not four features.
//
// It renders like the instrument deck rather than like a dialog, for the same
// reason: a modal in front of the conversation would break the standing
// instrumentation policy, and this is a surface a reader opens deliberately.
//
// The honest bits, which are the point:
//   · the link's real character count is printed, and flagged when it passes
//     the length mail clients mangle;
//   · nothing here claims the link is private — it isn't, it's base64;
//   · the scorecard only appears when there is an assessment to make one from,
//     and it is the assessment, not a summary of it.

const EXPORT_COPY = {
  empty: "Ask something first — there's nothing to export yet.",
  markdown:
    "The conversation as markdown, with each answer's sources listed under it. Pastes into Gmail, Slack, or an ATS note.",
  print:
    "Opens your browser's print dialog. “Save as PDF” there gives a typeset document with working links — not a screenshot of this page.",
  link:
    "The conversation is compressed into the part of the URL after the #, which browsers never send to a server. There is no database: the link is the storage.",
  linkCaveat:
    "It is encoding, not encryption — anyone holding the link can read the conversation — and it is frozen at the moment you made it.",
  linkTooLong:
    "Past the length some mail clients cut. Paste it somewhere that doesn't rewrite URLs, or export the markdown instead.",
  unsupported: "This browser can't build a link — the markdown and print options still work.",
  scorecard:
    "The assessment in scorecard shape: the verdict, the counts, the strongest cited rows, and every gap.",
  mail: "Opens a draft in your mail client with the condensed version already in the body.",
};

export function ExportDeck({
  messages,
  title,
  sourceUrl,
  footer,
  permalink,
  onPermalink,
  onPrint,
  onAction,
}: {
  messages: ChatMessage[];
  title: string;
  sourceUrl: string;
  footer: string;
  /** The link once generated, hoisted so the print document can carry it too. */
  permalink: string | null;
  onPermalink: (link: string | null) => void;
  onPrint: () => void;
  /** Fires on any completed export — drives the actions strip's emphasis. */
  onAction: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  // Deferred so the effect body doesn't setState synchronously; the same
  // pattern the shell uses for every after-mount capability check.
  useEffect(() => queueMicrotask(() => setSupported(permalinkSupported())), []);

  const markdown = useCallback(
    () => conversationToMarkdown(messages, { title, sourceUrl, footer, permalink: permalink ?? undefined }),
    [messages, title, sourceUrl, footer, permalink],
  );

  const fit = latestRoleFit(messages);

  const makeLink = useCallback(async () => {
    setBusy(true);
    try {
      const base = `${window.location.origin}/`;
      const link = await permalinkFor(base, messages);
      onPermalink(link);
      track("chat_permalink_created", { chars: link.length });
      onAction();
    } catch {
      // Compression unavailable or the conversation is somehow unserializable.
      // Saying nothing is better than a link that doesn't open.
      onPermalink(null);
      setSupported(false);
    } finally {
      setBusy(false);
    }
  }, [messages, onPermalink, onAction]);

  function download() {
    const blob = new Blob([markdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "conversation.md";
    a.click();
    URL.revokeObjectURL(url);
    track("chat_export", { kind: "file" });
    onAction();
  }

  if (!messages.length) {
    return <p className="text-[12px] leading-relaxed text-text-faint">{EXPORT_COPY.empty}</p>;
  }

  return (
    <div className="space-y-5 text-[12px]">
      <Section label="Markdown" note={EXPORT_COPY.markdown}>
        <CopyButton
          getText={markdown}
          label="copy the conversation"
          copiedLabel="copied"
          event="chat_copy_conversation"
          className="border border-line-strong px-2.5 py-2 hover:border-accent"
          onCopied={onAction}
        />
        <button type="button" onClick={download} className={BUTTON}>
          download .md
        </button>
      </Section>

      <Section label="Print" note={EXPORT_COPY.print}>
        <button
          type="button"
          onClick={() => {
            track("chat_export", { kind: "print" });
            onAction();
            onPrint();
          }}
          className={BUTTON}
        >
          print / save as PDF
        </button>
      </Section>

      <Section label="Link" note={EXPORT_COPY.link}>
        {supported ? (
          <>
            <button type="button" onClick={makeLink} disabled={busy} className={BUTTON}>
              {permalink ? "rebuild the link" : "build a link"}
            </button>
            {permalink && (
              <CopyButton
                getText={() => permalink}
                label="copy the link"
                copiedLabel="copied"
                event="chat_export"
                className="border border-line-strong px-2.5 py-2 hover:border-accent"
                onCopied={onAction}
              />
            )}
          </>
        ) : (
          <p className="text-text-faint">{EXPORT_COPY.unsupported}</p>
        )}
        {permalink && (
          <div className="w-full space-y-1">
            <p className="break-all text-[11px] text-text-soft">{permalink}</p>
            {/* Fable #14's byte count, kept because it is also the honest
                reading of whether this link will survive an email. */}
            <p className="text-[11px] text-text-faint">
              <span className="tabular-nums text-text-soft">{permalink.length}</span> characters
              {permalink.length > PERMALINK_SAFE_CHARS && (
                <span className="text-accent"> — {EXPORT_COPY.linkTooLong}</span>
              )}
            </p>
            <p className="text-[11px] leading-relaxed text-text-faint">{EXPORT_COPY.linkCaveat}</p>
          </div>
        )}
      </Section>

      {fit && (
        <Section label="Scorecard" note={EXPORT_COPY.scorecard}>
          <CopyButton
            getText={() =>
              scorecardMarkdown(fit, {
                title,
                sourceUrl,
                permalink: permalink ?? undefined,
                footer,
                labels: FIT_LABELS,
              })
            }
            label="copy the scorecard"
            copiedLabel="copied"
            event="chat_export"
            className="border border-line-strong px-2.5 py-2 hover:border-accent"
            onCopied={onAction}
          />
          <a
            href={mailtoHref({
              subject: `${title} — ${fit.role ?? ""}`.trim().replace(/[—-]\s*$/, "").trim(),
              body: scorecardMarkdown(fit, {
                sourceUrl,
                permalink: permalink ?? undefined,
                labels: FIT_LABELS,
              }),
            })}
            onClick={() => {
              track("chat_export", { kind: "mailto" });
              onAction();
            }}
            className={`${BUTTON} no-underline`}
          >
            open a mail draft
          </a>
          <p className="w-full text-[11px] leading-relaxed text-text-faint">{EXPORT_COPY.mail}</p>
          <p className="w-full text-[11px] text-text-faint">{verdictCounts(fit)}</p>
        </Section>
      )}
    </div>
  );
}

const BUTTON =
  "border border-line-strong px-2.5 py-2 text-[11px] text-text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-40";

function Section({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-b border-line pb-4 last:border-b-0">
      <div className="text-[11px] text-text-faint">{label}</div>
      <p className="text-[12px] leading-relaxed text-text-soft">{note}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
