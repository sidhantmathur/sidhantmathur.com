// What a panel is, said once.
//
// "A panel" used to be nine separate facts kept in agreement by hand: the
// discriminated union in use-conversation.ts, a structural mirror of half of it
// in shell-data.ts, a third copy of the kind names inside SLASH_COMMANDS, a
// title switch, a path map plus its inverse, a tool-output map, a dispatch in
// app-shell.tsx, and a carve-out naming `instruments` as the one panel a tool
// may not steal. Adding a tool to the chat touched eight files, five of them
// only to re-enumerate the kinds — and a typo in the slash registry opened
// nothing, silently, because nothing type-checked the string.
//
// PANELS below is now the table. `PanelKind` is its keys, so every downstream
// map is exhaustive by construction and a kind that isn't in the table cannot
// be named anywhere.
//
// NO REACT, NO `.tsx`, AND NO RUNTIME `@/` IMPORTS IN THIS FILE. evals/ loads
// it directly under `node --test --experimental-strip-types`, which resolves
// neither JSX nor the tsconfig path alias. The two imports here are `import
// type`, which strip-types erases entirely. The rendering half of the registry
// — which lazy component draws which panel — deliberately stays in
// app-shell.tsx: see `surface` below.

import type { ProjectSlug } from "@/content/projects";
import type { RoleFitResult } from "@/lib/role-fit";

// The reconciled assessment, exactly as lib/role-fit.ts returns it. The client
// re-derives none of it, and the `roleFit` panel is the surface that shows it.
export type RoleFit = RoleFitResult;

export type PanelSpec = {
  /**
   * The panel's title bar. For the three kinds whose title depends on their
   * payload (a project's name, a chunk's heading, the role being assessed)
   * this is the generic fallback and panel-title.ts computes the real one.
   */
  title: string;
  /** The address this panel shows, or null when it has none. */
  path: string | null;
  /** The slash command that opens it, or null. Hints are UI affordances. */
  slash: { name: string; hint: string } | null;
  /** The tool part whose output opens it, or null. Matches route.ts's tools. */
  fromTool: string | null;
  /**
   * False when a tool call may not replace this panel while it is open. Only
   * the instrument deck says false: it is opened deliberately, and having an
   * answer yank it away mid-reading would make the instruments feel like they
   * belong to the model rather than the reader.
   */
  stealable: boolean;
  /**
   * Who draws the body.
   *
   * "content" — PanelBody, from the corpus and the MDX case studies.
   * "shell"   — app-shell.tsx, because the surface is conversation or
   *             instrument state rather than content and needs that state
   *             threaded into it. Those components are lazily imported at
   *             their use site and must stay that way; a registry holding the
   *             modules would pull every panel body into the entry chunk.
   * "none"    — the closed panel.
   */
  surface: "none" | "content" | "shell";
};

// Order matters in one visible way: the slash palette is built from this table
// top to bottom, so this is the order a reader sees after typing "/".
export const PANELS = {
  none: {
    title: "",
    path: null,
    slash: null,
    fromTool: null,
    stealable: true,
    surface: "none",
  },
  resume: {
    title: "Resume",
    path: "/resume",
    slash: { name: "/resume", hint: "Open the resume in the panel" },
    fromTool: "tool-showResume",
    stealable: true,
    surface: "content",
  },
  projects: {
    title: "Projects",
    path: null,
    slash: { name: "/projects", hint: "List the three projects" },
    // Reached from `tool-showProject` only as a fallback, when the slug isn't
    // one of the three. The tool belongs to `project`; see panelForTool.
    fromTool: null,
    stealable: true,
    surface: "content",
  },
  contact: {
    title: "Contact",
    path: null,
    slash: { name: "/contact", hint: "Show contact links" },
    fromTool: "tool-contactCard",
    stealable: true,
    surface: "content",
  },
  jd: {
    // Also JD_COPY.heading — shell-data.ts reads it from here rather than
    // keeping a second copy. docs/site-copy.md → "Job-description fit".
    title: "Paste a job description",
    path: null,
    slash: { name: "/jd", hint: "Paste a job description" },
    fromTool: null,
    stealable: true,
    surface: "content",
  },
  instruments: {
    title: "Instruments",
    path: null,
    slash: { name: "/budget", hint: "Turns, tokens and what they cost" },
    fromTool: null,
    stealable: false,
    surface: "shell",
  },
  corpus: {
    title: "Sources",
    path: null,
    slash: { name: "/sources", hint: "Every source the answers are built from" },
    fromTool: null,
    stealable: true,
    surface: "content",
  },
  export: {
    title: "Export",
    path: null,
    slash: { name: "/pdf", hint: "Export — markdown, print, link" },
    fromTool: null,
    stealable: true,
    surface: "shell",
  },
  // Sprint 7's two published documents (#7, #10). Both are real pages as well;
  // the panel view is the version that opens beside the conversation.
  prompt: {
    title: "The instructions",
    path: null,
    slash: { name: "/prompt", hint: "Read the instructions it was given" },
    fromTool: null,
    stealable: true,
    surface: "content",
  },
  refusals: {
    title: "What it won't do",
    path: null,
    slash: { name: "/refusals", hint: "What it won't do, and why" },
    fromTool: null,
    stealable: true,
    surface: "content",
  },
  why: {
    title: "Why this site is a chatbot",
    path: null,
    slash: null,
    fromTool: null,
    stealable: true,
    surface: "content",
  },
  colophon: {
    title: "How this site was built",
    path: "/colophon",
    slash: null,
    fromTool: null,
    stealable: true,
    surface: "content",
  },
  // The three payload-carrying kinds. `path` is null for all of them because a
  // path names a kind and nothing more — a project's URL depends on its slug,
  // so use-panel-url.ts builds that one from the slug itself.
  project: {
    title: "Project",
    path: null,
    slash: null,
    fromTool: "tool-showProject",
    stealable: true,
    surface: "content",
  },
  source: {
    title: "Source",
    path: null,
    slash: null,
    fromTool: null,
    stealable: true,
    surface: "content",
  },
  roleFit: {
    title: "Role fit",
    path: null,
    slash: null,
    fromTool: "tool-roleFit",
    stealable: true,
    surface: "content",
  },
} as const satisfies Record<string, PanelSpec>;

export type PanelKind = keyof typeof PANELS;

export const PANEL_KINDS = Object.keys(PANELS) as PanelKind[];

// --- payloads ---------------------------------------------------------------
//
// The one thing the table can't describe. Four kinds carry data alongside their
// name, and the data is different in each case — a slug union, a chunk id, a
// whole assessment. Flattening them into a bag of optional fields would make
// the derivation below tidier and every read of it a lie, so they stay a
// hand-written map and the union is derived from the table plus this.

type PanelPayload = {
  resume: { focus?: string };
  project: { slug: ProjectSlug };
  source: { id: string };
  roleFit: { data: RoleFit };
};

export type PanelView = {
  [K in PanelKind]: { kind: K } & (K extends keyof PanelPayload ? PanelPayload[K] : unknown);
}[PanelKind];

/**
 * The kinds whose payload is mandatory. `resume` is not one of them — its
 * `focus` is optional, so `{ kind: "resume" }` is a complete view, which is why
 * a path and a slash command can name it.
 *
 * Listed once, as data, so the type and the runtime guard can't drift.
 */
const PAYLOAD_KINDS = ["project", "source", "roleFit"] as const satisfies readonly PanelKind[];

/** A kind that is fully described by its name — what a path or slash can open. */
export type PlainPanelKind = Exclude<PanelKind, (typeof PAYLOAD_KINDS)[number]>;

export function isPlainPanelKind(kind: PanelKind): kind is PlainPanelKind {
  return !(PAYLOAD_KINDS as readonly string[]).includes(kind);
}

/** The kinds app-shell draws itself. See `surface`. */
export type ShellPanelKind = {
  [K in PanelKind]: (typeof PANELS)[K]["surface"] extends "shell" ? K : never;
}[PanelKind];

export function isShellPanel(kind: PanelKind): kind is ShellPanelKind {
  return PANELS[kind].surface === "shell";
}

// --- derived lookups --------------------------------------------------------

/** Tool part type → the panel its output opens. */
export const PANEL_BY_TOOL: Record<string, PanelKind> = Object.fromEntries(
  PANEL_KINDS.flatMap((kind) => {
    const tool = PANELS[kind].fromTool;
    return tool ? [[tool, kind] as const] : [];
  }),
);

/** Path → the panel it represents. Only ever plain kinds; a path has no payload. */
export const PANEL_BY_PATH: Record<string, PlainPanelKind> = Object.fromEntries(
  PANEL_KINDS.flatMap((kind) => {
    const path = PANELS[kind].path;
    return path && isPlainPanelKind(kind) ? [[path, kind] as const] : [];
  }),
);

/** The panels a slash command opens, in the order the palette lists them. */
export const SLASH_PANELS = PANEL_KINDS.flatMap((kind) => {
  const slash = PANELS[kind].slash;
  return slash && isPlainPanelKind(kind) ? [{ ...slash, panel: kind }] : [];
});
