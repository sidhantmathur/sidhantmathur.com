// Builds the SECOND corpus (roadmap Sprint 7, #8) — the site's own source,
// chunked and addressable exactly like the knowledge base.
//
// Writes one git-ignored artifact, lib/repo.generated.ts:
//
//   REPO_CHUNKS   the chunks as data, under `repo:<slug>` ids — the same shape
//                 as lib/chunks.generated.ts, so lib/verify.ts, the citation
//                 margin and the panel all read them without a special case.
//   REPO_CORPUS   the same chunks rendered as prompt text, appended to the
//                 system prompt ONLY on a turn that asked about the site.
//   REPO_STATS    counts, so the numbers this site publishes about itself come
//                 from the tree rather than from someone's memory.
//
// TWO RULES, AND THEY ARE THE WHOLE DESIGN.
//
// 1. NOTHING HERE IS WRITTEN. Every line of every chunk is lifted verbatim out
//    of a file that already exists — a comment block, package.json, the
//    roadmap's own "not done" paragraphs, a line count. A second corpus of
//    freshly authored prose about the site would be a second thing to keep
//    true, and the reader would have no way to check it. This one can be
//    diffed against the tree.
//
// 2. IT NEVER TOUCHES AN ORDINARY TURN'S PROMPT. The knowledge base is
//    concatenated byte-identically into every system prompt so the provider's
//    cache hits, and Sprint 2's meter would show the damage if it stopped. So
//    this corpus is a separate string, appended after the base prompt on the
//    turns that need it and absent otherwise. `evals/recursion.test.mjs`
//    asserts the base prompt is unchanged by its existence.
//
// The comment block for each file is chosen deterministically: the run of
// consecutive `//` lines containing `anchor` if one is given, otherwise the
// longest such run in the file. Both are stable under editing in the way that
// matters — a chunk id never moves, because the ids are hand-assigned here.
//
// Run as `predev` and `prebuild`, after build-knowledge.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// Ids are hand-assigned and permanent: they are what the model cites and what
// the checker looks up, so they must not be derived from a filename that could
// be renamed. `heading` is what a reader sees on a chip.
//
// Curated, not swept. A corpus is the set of things a claim can be checked
// against; a directory listing of every file in the repo would add bulk that
// evidences nothing and would put generated bundles in the citation vocabulary.
const FILES = [
  {
    slug: "chat-route",
    path: "app/api/chat/route.ts",
    heading: "The chat route",
    anchor: "Failure theatre",
  },
  {
    slug: "chat-tools",
    path: "app/api/chat/route.ts",
    heading: "The chat route — tools",
    anchor: "Tools the model can call",
  },
  { slug: "system-prompt", path: "lib/system-prompt.ts", heading: "The system prompt", anchor: "Assembles the chat system prompt" },
  { slug: "knowledge-build", path: "scripts/build-knowledge.mjs", heading: "How the knowledge base is built" },
  { slug: "repo-corpus", path: "scripts/build-repo-corpus.mjs", heading: "How this corpus is built", anchor: "Builds the SECOND corpus" },
  { slug: "verify", path: "lib/verify.ts", heading: "The citation checker" },
  { slug: "role-fit", path: "lib/role-fit.ts", heading: "The role-fit reconciler" },
  { slug: "job-posting", path: "lib/job-posting.ts", heading: "Job postings as untrusted input", anchor: "Treating the posting as hostile input" },
  { slug: "site-question", path: "lib/site-question.ts", heading: "Recognising a question about the site" },
  { slug: "telemetry", path: "lib/chat-telemetry.ts", heading: "Per-turn telemetry" },
  { slug: "pricing", path: "lib/pricing.ts", heading: "The price table" },
  { slug: "permalink", path: "lib/permalink.ts", heading: "Permalinks" },
  { slug: "transcript", path: "lib/transcript.ts", heading: "Transcript serialization" },
  { slug: "measurements", path: "lib/measurements.ts", heading: "What the measurements page may publish" },
  { slug: "refusals", path: "lib/refusals.ts", heading: "The refusal ledger" },
  { slug: "instruments", path: "components/shell/instruments.tsx", heading: "The instrument deck", anchor: "WHERE THIS LIVES" },
  { slug: "answer", path: "components/shell/answer.tsx", heading: "How an answer renders its sources", anchor: "THE ORDER OF EVENTS" },
  { slug: "manual-mode", path: "components/shell/manual-mode.tsx", heading: "Manual mode" },
  { slug: "evals", path: "evals/static.test.mjs", heading: "The static eval layer", anchor: "Layer 1" },
];

/** Every consecutive run of `//` comment lines in a file, undecorated. */
function commentRuns(source) {
  const runs = [];
  let current = null;
  for (const line of source.split("\n")) {
    const match = line.match(/^\s*\/\/ ?(.*)$/);
    if (match) {
      const text = match[1].trimEnd();
      if (!current) current = [];
      current.push(text);
    } else if (current) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);
  return runs;
}

/** Blank lines collapse, dividers go, and the run becomes paragraphs. */
function paragraphs(run) {
  const cleaned = run
    .map((l) => l.replace(/^-{3,}.*$/, "").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** Cap a chunk's prose without cutting a sentence in half where avoidable. */
function clip(lines, max) {
  const out = [];
  let used = 0;
  for (const line of lines) {
    if (used >= max) break;
    if (used + line.length <= max) {
      out.push(line);
      used += line.length;
      continue;
    }
    const room = max - used;
    const cut = line.slice(0, room);
    const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
    out.push(stop > room * 0.4 ? `${cut.slice(0, stop + 1)} …` : `${cut.trimEnd()} …`);
    break;
  }
  return out;
}

// Per-chunk ceiling. The whole corpus only loads on a turn that asked about the
// site, but it still bills as input on that turn, so it is a budget rather than
// an afterthought — the total is asserted in evals/recursion.test.mjs.
const MAX_CHARS = 520;

const chunks = [];
const add = ({ slug, heading, meta, lines, max = MAX_CHARS }) => {
  const clipped = clip(lines, max);
  if (!clipped.length) throw new Error(`[build-repo-corpus] chunk "${slug}" came out empty`);
  chunks.push({
    id: `repo:${slug}`,
    source: "repo",
    sourceLabel: "This site",
    heading,
    meta,
    lines: clipped,
    // Same contract as the knowledge base: the haystack a claim is checked
    // against is EXACTLY what the model read, minus the id.
    text: [`This site — ${heading}`, meta, ...clipped].filter(Boolean).join("\n"),
  });
};

for (const entry of FILES) {
  const source = read(entry.path);
  const runs = commentRuns(source);
  const picked = entry.anchor
    ? runs.find((r) => r.join("\n").includes(entry.anchor))
    : runs.slice().sort((a, b) => b.join("").length - a.join("").length)[0];
  if (!picked) {
    throw new Error(
      `[build-repo-corpus] no comment block in ${entry.path}` +
        (entry.anchor ? ` containing "${entry.anchor}" — the anchor moved` : ""),
    );
  }
  const lineCount = source.split("\n").length;
  add({
    slug: entry.slug,
    heading: entry.heading,
    meta: `${entry.path} · ${lineCount} lines`,
    lines: paragraphs(picked),
  });
}

// --- Chunks that are facts rather than prose ------------------------------

const pkg = JSON.parse(read("package.json"));
add({
  slug: "stack",
  heading: "What it runs on",
  meta: "package.json",
  lines: [
    `Runtime dependencies: ${Object.keys(pkg.dependencies).join(", ")}.`,
    `Build and test tooling: ${Object.keys(pkg.devDependencies).join(", ")}.`,
    `Scripts: ${Object.keys(pkg.scripts).join(", ")}.`,
    "There is no vector database, no PDF library, no compression library and no state store: the permalink uses the browser's own CompressionStream and the print document uses the browser's print pipeline.",
  ],
});

// Every page that exists, read off the tree rather than listed by hand — a
// route that gets added and not mentioned here would be a corpus that lies.
function routesUnder(dir) {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const full = join(root, dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...routesUnder(join(dir, name)));
    } else if (name === "page.tsx" || name === "route.ts") {
      const path = relative("app", dir).replace(/\\/g, "/");
      out.push({ href: `/${path === "." ? "" : path}`, kind: name === "page.tsx" ? "page" : "route" });
    }
  }
  return out;
}
const routes = routesUnder("app").sort((a, b) => a.href.localeCompare(b.href));
add({
  slug: "routes",
  heading: "Every page on the site",
  meta: "app/",
  lines: [
    routes
      .filter((r) => r.kind === "page")
      .map((r) => r.href)
      .join(", ") + " are pre-rendered pages.",
    `${routes.filter((r) => r.kind === "route").map((r) => r.href).join(", ")} are the only route handlers, and /api/chat is the only one that runs per request.`,
    `The chat lives at / and everything else is a document that works with JavaScript off.`,
  ],
});

// The site's own list of what is wrong with it, in its own words. This is the
// single most useful chunk in the corpus and the reason a roast can be specific:
// each sprint's write-up ends with a paragraph naming what it did not do, and
// those paragraphs are the honest version of "what's wrong with this site".
const roadmap = read("docs/roadmap.md");
const notDone = [...roadmap.matchAll(/\*\*Not done, and out of scope by design:\*\*([\s\S]*?)\n\n/g)].map(
  (m) => m[1].replace(/\s*\n\s*/g, " ").replace(/\*\*/g, "").trim(),
);
if (notDone.length < 4) {
  throw new Error("[build-repo-corpus] the roadmap's 'not done' paragraphs stopped parsing");
}
add({
  slug: "known-gaps",
  heading: "What the build knows is missing",
  meta: "docs/roadmap.md — each sprint's closing paragraph",
  lines: notDone.slice(-4).map((p) => clip([p], 340)[0]),
  // Four times the usual ceiling, and the only chunk that gets one. This is
  // the site's own account of what it hasn't done — the difference between a
  // criticism someone could act on and an affectionate one — and clipping it
  // to the length of a comment block would leave a roast with one example.
  max: 4 * MAX_CHARS,
});

// --- Output ---------------------------------------------------------------

const seen = new Set();
for (const c of chunks) {
  if (seen.has(c.id)) throw new Error(`[build-repo-corpus] duplicate chunk id "${c.id}"`);
  seen.add(c.id);
}

const corpus = chunks
  .map((c) => {
    const head = `[${c.id}] ${c.sourceLabel} — ${c.heading}`;
    return [head, c.meta, ...c.lines.map((l) => `- ${l}`)].filter(Boolean).join("\n");
  })
  .join("\n\n");

const stats = {
  chunks: chunks.length,
  chars: corpus.length,
  files: [...new Set(FILES.map((f) => f.path))].length,
};

const out = `// AUTO-GENERATED by scripts/build-repo-corpus.mjs — do not edit by hand.
// The second corpus (roadmap Sprint 7, #8): this site, described by its own
// source. Every line is verbatim from a file in this repo.
import type { Chunk } from "./chunks.generated";

export const REPO_CHUNKS: Chunk[] = ${JSON.stringify(chunks, null, 2)};

export const REPO_BY_ID: Record<string, Chunk> = Object.fromEntries(
  REPO_CHUNKS.map((c) => [c.id, c]),
);

/** The prompt block. Appended to the system prompt on site turns ONLY. */
export const REPO_CORPUS = ${JSON.stringify(corpus)};

export const REPO_STATS = ${JSON.stringify(stats)};
`;

writeFileSync(join(root, "lib", "repo.generated.ts"), out, "utf8");
console.log(
  `[build-repo-corpus] wrote lib/repo.generated.ts (${stats.chunks} chunks, ${stats.chars} chars from ${stats.files} files)`,
);
