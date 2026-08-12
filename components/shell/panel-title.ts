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
import { PANELS, type PanelView } from "./panels";

/**
 * The panel's title, for both chromes.
 *
 * Twelve of the fifteen kinds have a title that is a constant, and those live
 * in the registry with everything else about them. What survives here is only
 * the three whose title is computed from a payload — a project's name, the
 * chunk a citation opened, the role an assessment was made against.
 */
export function panelTitle(panel: PanelView): string {
  switch (panel.kind) {
    case "project":
      return PROJECTS[panel.slug].title;
    case "source": {
      const chunk = ALL_CHUNKS_BY_ID[panel.id];
      return chunk ? `${chunk.sourceLabel} — ${chunk.heading}` : panel.id;
    }
    case "roleFit":
      return `${PANELS.roleFit.title} — ${panel.data.role}`;
    default:
      return PANELS[panel.kind].title;
  }
}
