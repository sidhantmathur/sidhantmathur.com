// The panel's title bar, split out from panel-body.tsx.
//
// SPLIT FOR A LOAD-ORDER REASON, not a tidiness one. Both panel chromes — the
// desktop aside and the mobile sheet — render this title, and both are on the
// page from the first paint. panel-body.tsx, meanwhile, is the heaviest module
// in the shell: three MDX case studies, the whole knowledge base, the repo
// corpus and the system-prompt builder, none of which is needed until someone
// opens a panel. As long as the title lived there, importing the title imported
// all of it, and `next/dynamic` around PanelBody bought nothing at all — the
// bytes were already in the entry chunk.
//
// So the title comes here and PanelBody loads on demand. Everything this file
// pulls in is either small or already needed elsewhere in the shell.

import { PROJECTS } from "@/content/projects";
import { ALL_CHUNKS_BY_ID } from "@/lib/corpus";
import { JD_COPY } from "./shell-data";
import type { PanelView } from "./use-conversation";

export function panelTitle(panel: PanelView): string {
  switch (panel.kind) {
    case "resume":
      return "Resume";
    case "projects":
      return "Projects";
    case "contact":
      return "Contact";
    case "why":
      return "Why this site is a chatbot";
    case "colophon":
      return "How this site was built";
    case "jd":
      return JD_COPY.heading;
    // Rendered by app-shell, not PanelBody — the deck is instrument state, not
    // content. The title still belongs here so both panel chromes agree.
    case "instruments":
      return "Instruments";
    // Rendered by app-shell for the same reason as the deck: the export
    // surface is conversation state, not content.
    case "export":
      return "Export";
    case "corpus":
      return "Sources";
    case "prompt":
      return "The instructions";
    case "refusals":
      return "What it won't do";
    case "project":
      return PROJECTS[panel.slug].title;
    case "source": {
      const chunk = ALL_CHUNKS_BY_ID[panel.id];
      return chunk ? `${chunk.sourceLabel} — ${chunk.heading}` : panel.id;
    }
    case "roleFit":
      return `Role fit — ${panel.data.role}`;
    default:
      return "";
  }
}
