// Builds two artifacts from content/knowledge/*.md, both git-ignored:
//
//   1. KNOWLEDGE_BASE — the corpus rendered as labeled chunks and injected into
//      the system prompt. Byte-identical across builds so the Anthropic prompt
//      cache stays stable.
//   2. CHUNKS — the same chunks as structured data, addressed by the SAME ids
//      that appear in (1).
//
// (2) exists so the panel, the model, and the verifier read the SAME source.
// The panel used to hold a hand-maintained copy of the resume's sections, which
// meant the evidence shown beside an answer could silently drift from the
// evidence the answer was built from. Editing the markdown now updates all
// three.
//
// SPRINT 3 (F2). Two changes to what this script used to do:
//
//   * It chunks the WHOLE corpus, not just resume.md. Six files, one id space.
//   * Every chunk's id is rendered INTO the knowledge base, so the model reads
//     the vocabulary and the text it names in the same breath. There is no
//     separate "here are the ids" list to fall out of sync — if a chunk exists,
//     its id is on the line above it.
//
// The ids are what the model cites and what lib/verify.ts checks a claim
// against, so they have to be stable across builds: they're derived from the
// markdown headings, and a heading rename is a deliberate act with a visible
// consequence (the static evals assert the ids the shell hardcodes still exist).
//
// Run as `predev` and `prebuild`.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Fixed order — do not reorder without re-checking the token budget (~8k target).
//
// `source` is the id namespace for the file's chunks, so it is part of the
// public id vocabulary and changing one invalidates every citation that names
// it. `label` is what a reader sees on a chip in the panel.
const FILES = [
  { file: "resume.md", source: "resume", label: "Resume" },
  { file: "bio.md", source: "bio", label: "About" },
  { file: "projects-adarle20.md", source: "adarle20", label: "A Darle 20" },
  { file: "projects-nokia.md", source: "nokia", label: "Nokia" },
  { file: "projects-dell.md", source: "dell", label: "Dell" },
  { file: "faq.md", source: "faq", label: "FAQ" },
];

function slugify(text) {
  return text
    .toLowerCase()
    // Apostrophes close up rather than splitting: "what he'd tell" →
    // "what-hed-tell", not "what-he-d-tell".
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Bullets are `- ` lines; wrapped continuation lines are indented. Rejoin them
// so a bullet is one string rather than one string per source line.
function parseBullets(body) {
  const out = [];
  for (const line of body.split("\n")) {
    if (/^\s*-\s+/.test(line)) {
      out.push(line.replace(/^\s*-\s+/, "").trim());
    } else if (out.length && line.trim() && /^\s+/.test(line)) {
      out[out.length - 1] += " " + line.trim();
    } else if (!line.trim()) {
      // blank line ends the current bullet run
    }
  }
  return out;
}

/** Paragraphs that aren't bullets or headings, each rejoined to one line. */
function parseProse(body) {
  return body
    .split("\n\n")
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p && !p.startsWith("-") && !p.startsWith("#"));
}

/**
 * Lines a reader sees for a chunk: its bullets if it has any, its prose if not.
 * A chunk with both (the resume's Experience blocks have a bold dateline above
 * their bullets) keeps the dateline in `meta` instead.
 */
function renderLines(body) {
  const bullets = parseBullets(body);
  return bullets.length ? bullets : parseProse(body);
}

// --- Chunking -------------------------------------------------------------
//
// One chunk per `##` section, plus one per `###` block inside a section that
// has them (only the resume's Experience does today). Anything before the first
// `##` — the file's `# Title` and any lead paragraph — becomes an `overview`
// chunk, which is where projects-dell.md's entire body lives.
//
// Granularity is a real decision, not an accident of the markdown: a chunk is
// the smallest unit a claim can honestly be checked against. Finer (per bullet)
// would make a two-fact sentence uncitable without listing four ids; coarser
// (per file) would make "it's in there somewhere" pass verification.

function chunkFile({ file, source, label }) {
  const raw = readFileSync(join(root, "content", "knowledge", file), "utf8");
  const chunks = [];

  const add = ({ slug, heading, meta, body }) => {
    const lines = renderLines(body);
    if (!lines.length) return;
    chunks.push({
      id: `${source}:${slug}`,
      source,
      sourceLabel: label,
      heading,
      meta,
      lines,
      // The text a claim is checked against. It is EXACTLY what the model sees
      // for this chunk in the knowledge base below, minus the id itself — the
      // label and dateline included, because "A Darle 20" and "Jun 2024" live
      // in those lines and nowhere else, and a sentence citing this chunk for
      // one of them is citing correctly. Any gap between what the model reads
      // and what the checker searches shows up as a false "unverified", which
      // is the most expensive kind of wrong this feature can be.
      text: [`${label} — ${heading}`, meta, ...lines].filter(Boolean).join("\n"),
    });
  };

  // Everything above the first `## ` heading.
  const firstSection = raw.search(/^## /m);
  const head = (firstSection === -1 ? raw : raw.slice(0, firstSection)).trim();
  const title = head.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? label;
  add({
    slug: "overview",
    heading: title,
    meta: "",
    body: head.replace(/^#\s+.+$/m, ""),
  });

  if (firstSection === -1) return chunks;

  for (const section of raw.slice(firstSection).split(/\n## |^## /m).filter(Boolean)) {
    const nl = section.indexOf("\n");
    const heading = (nl === -1 ? section : section.slice(0, nl)).trim();
    const body = nl === -1 ? "" : section.slice(nl + 1);

    // A section whose body is `### ` blocks chunks per block instead of once.
    if (/^### /m.test(body)) {
      for (const block of body.split(/\n### |^### /m).slice(1)) {
        const bnl = block.indexOf("\n");
        const blockHeading = (bnl === -1 ? block : block.slice(0, bnl)).trim();
        const bbody = bnl === -1 ? "" : block.slice(bnl + 1);
        // The first `**bold**` line is the role/dateline. An employer with more
        // than one role has more than one — Nokia does — and those later
        // datelines become lines of the chunk rather than being dropped. They
        // carry dates nothing else in the resume carries, and a claim citing
        // this chunk for one of them has to find it here.
        const roleMatch = bbody.match(/\*\*(.+?)\*\*/);
        const withRoles = bbody
          .replace(roleMatch?.[0] ?? "", "")
          .replace(/^\*\*(.+?)\*\*\s*$/gm, "- $1");
        // Strip parentheticals and everything after the first em dash so the id
        // stays short and stable: `A Darle 20 ("Let's Go 20") — adarle20.com —
        // Toronto, ON` becomes `a-darle-20`.
        add({
          slug: slugify(blockHeading.split("—")[0].replace(/\(.*?\)/g, "")),
          heading: blockHeading,
          meta: roleMatch ? roleMatch[1].trim() : "",
          body: withRoles,
        });
      }
      continue;
    }

    add({ slug: slugify(heading), heading, meta: "", body });
  }

  return chunks;
}

const chunks = FILES.flatMap(chunkFile);

// An id collision would make two different pieces of the record answer to the
// same citation, which is exactly the failure the verifier exists to prevent.
// Fail the build rather than ship an ambiguous id space.
const seen = new Set();
for (const c of chunks) {
  if (seen.has(c.id)) {
    throw new Error(
      `[build-knowledge] duplicate chunk id "${c.id}" — two headings slugify the same way. Rename one.`,
    );
  }
  seen.add(c.id);
}

// --- The knowledge base ---------------------------------------------------
//
// Rendered from the chunks rather than by concatenating the files, so what the
// model reads and what the verifier checks are the same bytes. The `[id]` on
// the heading line IS the vocabulary — see lib/system-prompt.ts, which tells
// the model what to do with it.

const knowledge = chunks
  .map((c) => {
    const head = `[${c.id}] ${c.sourceLabel} — ${c.heading}`;
    return [head, c.meta, ...c.lines.map((l) => `- ${l}`)].filter(Boolean).join("\n");
  })
  .join("\n\n");

// JSON.stringify escapes backticks, ${, backslashes, and newlines safely —
// avoids the fragility of hand-escaping a template literal.
const out = `// AUTO-GENERATED by scripts/build-knowledge.mjs — do not edit by hand.
export const KNOWLEDGE_BASE = ${JSON.stringify(knowledge)};
`;

const outChunks = `// AUTO-GENERATED by scripts/build-knowledge.mjs — do not edit by hand.
// The addressable corpus (roadmap Sprint 3, F2). Every chunk here is rendered
// into KNOWLEDGE_BASE under the same id, so the text the model reads, the text
// the panel shows, and the text lib/verify.ts checks a claim against are one
// thing rather than three copies of it.
export type Chunk = {
  /** Stable citation id, \`<source>:<slug>\`. This is what the model emits. */
  id: string;
  source: string;
  sourceLabel: string;
  heading: string;
  /** Role/dateline for an experience block; empty otherwise. */
  meta: string;
  /** Display lines — the chunk's bullets, or its prose paragraphs. */
  lines: string[];
  /** Everything above as one string. The haystack a claim is verified against. */
  text: string;
};

export const CHUNKS: Chunk[] = ${JSON.stringify(chunks, null, 2)};

export const CHUNK_BY_ID: Record<string, Chunk> = Object.fromEntries(
  CHUNKS.map((c) => [c.id, c]),
);
`;

const target = join(root, "lib", "knowledge.generated.ts");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, out, "utf8");

const chunkTarget = join(root, "lib", "chunks.generated.ts");
writeFileSync(chunkTarget, outChunks, "utf8");

console.log(
  `[build-knowledge] wrote ${target} (${knowledge.length} chars from ${FILES.length} files)`,
);
console.log(
  `[build-knowledge] wrote ${chunkTarget} (${chunks.length} chunks: ${chunks
    .map((c) => c.id)
    .join(", ")})`,
);
