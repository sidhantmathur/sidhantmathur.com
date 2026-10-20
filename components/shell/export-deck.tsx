"use client";

import { useCallback, useEffect, useState } from "react";
import {
  conversationToMarkdown,
  latestRoleFit,
  mailtoHref,
  scorecardMarkdown,
  verdictCounts,
} from "@/lib/transcript";
import {
  PERMALINK_SAFE_CHARS,
  fitPermalinkFor,
  permalinkFor,
  permalinkSupported,
} from "@/lib/permalink";
import { DISCLAIMER, SITE_NAME, SITE_URL } from "@/lib/site";
import { track } from "@/lib/analytics";
import { CopyButton } from "./copy-button";
import { FIT_LABELS } from "./shell-data";
import type { ChatMessage } from "./use-conversation";

// The export panel (docs/idea-decisions.md #17 and #24): markdown, print, a
// permalink and, when the conversation holds an assessment, the scorecard and
// the short fit link. Several handles on one conversation in one panel view,
// opened deliberately like the instrument deck rather than as a modal.
//
// The link's real character count is printed and flagged past the length mail
// clients mangle. Nothing here may claim the link is private: it is encoding,
// not encryption. The scorecard is the assessment itself, not a summary.

const EXPORT_COPY = {
  empty: "There's nothing to export yet. Ask something first.",
  markdown:
    "The conversation as markdown, with each answer's sources listed under it. Pastes into Gmail, Slack, or an ATS note.",
  print:
    "Opens your browser's print dialog. “Save as PDF” there gives a document laid out for paper, with working links.",
  link:
    "The conversation is compressed into the part of the URL after the #, which browsers never send to a server. The site has no database, so it doesn't keep a copy.",
  linkCaveat:
    "The link isn't encrypted. Anyone who has it can read the conversation. It's frozen at the moment you made it.",
  linkTooLong:
    "Some mail clients cut links this long. Paste it somewhere that doesn't rewrite URLs, or use the markdown instead.",
  unsupported: "This browser can't build a link. The markdown and print options still work.",
  scorecard:
    "The assessment in scorecard shape: the verdict, the counts, the strongest cited rows, and every gap.",
  // The short fit link (docs/application-links.md). Logged in the ledger.
  shortLink:
    "The same scorecard as a link, with the answer's summary. It's short enough for an application form or a plain-text email, and it leaves the posting out.",
  mail: "Opens a draft in your mail client with the condensed version already in the body.",
};

export function ExportDeck({
  messages,
  permalink,
  onPermalink,
  onPrint,
  onAction,
}: {
  messages: ChatMessage[];
  /** The link once generated, hoisted so the print document can carry it too. */
  permalink: string | null;
  onPermalink: (link: string | null) => void;
  onPrint: () => void;
  /** Fires on any completed export — drives the actions strip's emphasis. */
  onAction: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);
  // Deferred so the effect body doesn't setState synchronously.
  useEffect(() => queueMicrotask(() => setSupported(permalinkSupported())), []);

  const markdown = useCallback(
    () =>
      conversationToMarkdown(messages, {
        title: SITE_NAME,
        sourceUrl: SITE_URL,
        footer: DISCLAIMER,
        permalink: permalink ?? undefined,
      }),
    [messages, permalink],
  );

  const fit = latestRoleFit(messages);

  // Local rather than hoisted like `permalink`: nothing else on the page
  // carries the short link.
  const [shortLink, setShortLink] = useState<string | null>(null);
  const makeShortLink = useCallback(async () => {
    setBusy(true);
    try {
      const link = await fitPermalinkFor(`${window.location.origin}/`, messages);
      setShortLink(link);
      if (link) track("chat_permalink_created", { chars: link.length, kind: "fit" });
      onAction();
    } catch {
      setShortLink(null);
      setSupported(false);
    } finally {
      setBusy(false);
    }
  }, [messages, onAction]);

  const makeLink = useCallback(async () => {
    setBusy(true);
    try {
      const base = `${window.location.origin}/`;
      const link = await permalinkFor(base, messages);
      onPermalink(link);
      track("chat_permalink_created", { chars: link.length });
      onAction();
    } catch {
      // Compression unavailable or the conversation unserializable. No link is
      // better than one that doesn't open.
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
    return <p className="t-meta text-text-faint">{EXPORT_COPY.empty}</p>;
  }

  return (
    <div className="t-meta space-y-5">
      <Section label="Markdown" note={EXPORT_COPY.markdown}>
        <CopyButton
          getText={markdown}
          label="copy the conversation"
          copiedLabel="copied"
          event="chat_copy_conversation"
          className="inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 hover:border-accent"
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
                className="inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 hover:border-accent"
                onCopied={onAction}
              />
            )}
          </>
        ) : (
          <p className="text-text-faint">{EXPORT_COPY.unsupported}</p>
        )}
        {permalink && (
          <div className="w-full space-y-1">
            <p className="t-meta break-all text-text-soft">{permalink}</p>
            <p className="t-meta text-text-faint">
              <span className="tabular-nums text-text-soft">{permalink.length}</span> characters
              {permalink.length > PERMALINK_SAFE_CHARS && (
                <span className="text-accent">. {EXPORT_COPY.linkTooLong}</span>
              )}
            </p>
            <p className="t-meta text-text-faint">{EXPORT_COPY.linkCaveat}</p>
          </div>
        )}
      </Section>

      {fit && (
        <Section label="Scorecard" note={EXPORT_COPY.scorecard}>
          <CopyButton
            getText={() =>
              scorecardMarkdown(fit, {
                title: SITE_NAME,
                sourceUrl: SITE_URL,
                permalink: permalink ?? undefined,
                footer: DISCLAIMER,
                labels: FIT_LABELS,
              })
            }
            label="copy the scorecard"
            copiedLabel="copied"
            event="chat_export"
            className="inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 hover:border-accent"
            onCopied={onAction}
          />
          <a
            href={mailtoHref({
              subject: `${SITE_NAME} — ${fit.role ?? ""}`.trim().replace(/[—-]\s*$/, "").trim(),
              body: scorecardMarkdown(fit, {
                sourceUrl: SITE_URL,
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
          <p className="t-meta w-full text-text-faint">{EXPORT_COPY.mail}</p>
          <p className="t-meta w-full text-text-faint">{verdictCounts(fit)}</p>
        </Section>
      )}

      {fit && supported && (
        <Section label="Short link" note={EXPORT_COPY.shortLink}>
          <button type="button" onClick={makeShortLink} disabled={busy} className={BUTTON}>
            {shortLink ? "rebuild the short link" : "build a short link"}
          </button>
          {shortLink && (
            <CopyButton
              getText={() => shortLink}
              label="copy the short link"
              copiedLabel="copied"
              event="chat_export"
              className="inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 hover:border-accent"
              onCopied={onAction}
            />
          )}
          {shortLink && (
            <div className="w-full space-y-1">
              <p className="t-meta break-all text-text-soft">{shortLink}</p>
              <p className="t-meta text-text-faint">
                <span className="tabular-nums text-text-soft">{shortLink.length}</span> characters
                {shortLink.length > PERMALINK_SAFE_CHARS && (
                  <span className="text-accent">. {EXPORT_COPY.linkTooLong}</span>
                )}
              </p>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

const BUTTON =
  "inline-flex min-h-[44px] items-center border border-line-strong px-3 py-2.5 t-meta text-text-soft transition-colors hover:border-accent hover:text-accent disabled:border-line disabled:text-text-dim";

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
      <div className="t-label text-text-faint">{label}</div>
      <p className="t-meta text-text-soft">{note}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
