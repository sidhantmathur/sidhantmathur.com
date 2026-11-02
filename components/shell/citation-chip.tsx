"use client";

import { SLUG_TO_RESUME } from "./shell-data";
import type { PanelView, RoleFit, ToolOut } from "./use-conversation";

// Sits under an answer and reopens the evidence it was built from. On mobile,
// where tool calls don't raise the panel sheet, this is the way into it, so
// the newest turn's chips are marked.
export function CitationChip({
  out,
  latest,
  onOpen,
}: {
  out: ToolOut;
  latest: boolean;
  onOpen: (v: PanelView) => void;
}) {
  let label = "Source";
  let view: PanelView = { kind: "resume" };

  if (out.type === "tool-showProject") {
    const o = out.output as { slug?: string; title?: string };
    label = o?.title ?? "Project";
    // A slug without a SLUG_TO_RESUME entry (Dell) opens the projects list.
    const focus = SLUG_TO_RESUME[o?.slug ?? ""];
    view = focus ? { kind: "resume", focus } : { kind: "projects" };
  } else if (out.type === "tool-showResume") {
    label = "Resume";
  } else if (out.type === "tool-contactCard") {
    label = "Contact";
    view = { kind: "contact" };
  } else if (out.type === "tool-roleFit") {
    const data = out.output as RoleFit;
    label = `Role fit — ${data.role}`;
    view = { kind: "roleFit", data };
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(view)}
      // Same padding as the source chips in answer.tsx — they sit in adjacent
      // rows under the same answer and were two different sizes.
      className={`border px-3 py-2.5 t-meta transition-colors hover:border-accent hover:text-accent ${
        latest ? "border-line-strong text-text-soft" : "border-line text-text-faint"
      }`}
    >
      ↗ {label}
    </button>
  );
}
