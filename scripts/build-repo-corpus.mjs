// Builds the SECOND corpus: the site's own source, chunked and addressable like
// the knowledge base. Writes one git-ignored file, lib/repo.generated.ts:
//
//   REPO_CHUNKS   the chunks as data, under `repo:<slug>` ids, in the same
//                 shape as lib/chunks.generated.ts so lib/corpus.ts can merge
//                 both into one citation lookup.
//   REPO_CORPUS   the same chunks as prompt text, appended to the system prompt
//                 only on a turn that asked about the site.
//   REPO_STATS    counts, so the numbers the site publishes about itself come
//                 from the tree.
//
// Apart from the two chunks assembled from package.json and the app/ tree,
// nothing is authored here: every line is lifted verbatim from a file in the
// repo (a comment block, the roadmap's "not done" paragraphs), so the corpus
// can be checked against the tree rather than kept true by hand.
// evals/recursion.test.mjs checks each line against the file it names.
//
// It never touches an ordinary turn's prompt. The knowledge base is the same
// bytes in every system prompt so the provider's cache hits; this corpus is a
// separate string appended only on site turns, and evals/recursion.test.mjs
// asserts the base prompt carries none of it.
//
// Each file's comment block is the run of consecutive `//` lines containing
// `anchor` if one is given, otherwise the longest run in the file. Chunk ids
// are hand-assigned below, so editing a comment never moves one.
//
// Runs as `predev` and `prebuild`, after build-knowledge.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// Ids are hand-assigned and permanent: the model cites them, so they must not
// derive from a filename that could be renamed. `heading` is the chip text.
// An `anchor` is matched against comment text in the named file, so editing
// that comment can break the build. Each file's quoted block is also read by
// visitors (the chat cites it and the panel renders it), so comments in these
// files are copy as well as documentation.
//
// Curated rather than swept: every file in the repo would add bulk that
// evidences nothing and put generated bundles in the citation vocabulary.
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
  // lib/models.ts holds the prices and the allowlist; lib/pricing.ts is only
  // the arithmetic over them.
  { slug: "pricing", path: "lib/models.ts", heading: "The model catalogue and its prices" },
  { slug: "permalink", path: "lib/permalink.ts", heading: "Permalinks" },
  { slug: "transcript", path: "lib/transcript.ts", heading: "Transcript serialization" },
  { slug: "measurements", path: "lib/measurements.ts", heading: "What the measurements page may publish" },
  { slug: "refusals", path: "lib/refusals.ts", heading: "What the assistant won't do" },
  { slug: "instruments", path: "components/shell/instruments.tsx", heading: "Technical details panel", anchor: "WHERE THIS LIVES" },
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

// Per-chunk ceiling. The corpus still bills as input on a site turn; the total
// is asserted in evals/recursion.test.mjs.
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
    // As in the knowledge base: the text a claim is checked against is what
    // the model read, minus the id.
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

// Read off the tree rather than listed by hand, so a new route can't be missed.
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

// The site's own list of what it hasn't done: each sprint in docs/roadmap.md
// ends with a "Not done" paragraph, and the last four become one chunk. This is
// what lets a roast be specific.
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
  // The only chunk with a raised ceiling: at the usual one a roast would get a
  // single example.
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
