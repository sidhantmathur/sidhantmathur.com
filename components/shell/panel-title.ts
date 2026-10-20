// The panel's title bar, for both chromes (the desktop aside and the mobile
// sheet). Split out of panel-body.tsx for load order: both chromes render from
// first paint, while panel-body.tsx carries the MDX case studies, the knowledge
// base, the repo corpus and the system-prompt builder. Importing the title from
// there would put all of that in the entry chunk and defeat the lazy PanelBody.

import { PROJECTS } from "@/content/projects";
import { ALL_CHUNKS_BY_ID } from "@/lib/corpus";
import { PANELS, type PanelView } from "./panels";

/**
 * Constant titles live in the PANELS registry. Only the three kinds whose title
 * comes from a payload are computed here: a project's name, the chunk a
 * citation opened, the role an assessment was made against.
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
