// Builds two git-ignored files from content/knowledge/*.md:
//
//   lib/knowledge.generated.ts   KNOWLEDGE_BASE, the corpus rendered as labeled
//                                chunks for the system prompt. Byte-identical
//                                for identical input, so a rebuild doesn't
//                                break the provider's prompt cache.
//   lib/chunks.generated.ts      CHUNKS, the same chunks as structured data
//                                under the same ids.
//
// The model, the evidence panel and lib/verify.ts all read these, so editing
// the markdown updates all three. Each chunk's id is printed on the line above
// its text in the knowledge base; there is no separate id list to drift.
//
// Ids are what the model cites and what the verifier checks, so they must be
// stable: they derive from the markdown headings, and renaming a heading
// changes a public id (evals/citations.test.mjs asserts the ids the shell
// hardcodes still exist). Fails the build on a duplicate id.
//
// Runs as `predev` and `prebuild`.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Fixed order; re-check the ~8k token budget (asserted in evals/static.test.mjs)
// before reordering or adding a file.
//
// `source` is the id namespace for the file's chunks, so changing one
// invalidates every citation that names it. `label` is the panel chip text.
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
// One chunk per `##` section, or one per `###` block in a section that has
// them (the resume's Experience). Anything before the first `##` becomes an
// `overview` chunk, which is all of projects-dell.md.
//
// A chunk is the smallest unit a claim is checked against. Per bullet would
// make a two-fact sentence need several ids; per file would let "it's in there
// somewhere" pass verification.

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
      // The text a claim is checked against: what the model sees for this chunk
      // in the knowledge base, minus the id. The heading line and dateline are
      // included because an employer name or a date may appear only there. Any
      // gap between the two shows up as a false "unverified".
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
        // than one role (Nokia) has more; those become lines of the chunk, since
        // their dates appear nowhere else.
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

const allChunks = FILES.flatMap(chunkFile);

// --- Held back: a chunk with an unresolved marker ---------------------------
//
// A `[TODO` or `[VERIFY` in content/knowledge is a question for Sidhant, not
// part of the record. The model would read it as a line about him, and /prompt
// publishes the prompt verbatim. So the chunk stays in the markdown and out of
// both generated files until it has an answer. Both rather than one, so the
// ids the model is shown and the ids the panel can open stay one set
// (evals/static.test.mjs checks both files).
const MARKER = /\[(TODO|VERIFY)\b/;
const heldBack = allChunks.filter((c) => MARKER.test(c.text));
const chunks = allChunks.filter((c) => !MARKER.test(c.text));

// A collision would make one citation point at two pieces of the record.
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
// model reads and what the verifier checks are the same text. The `## Citing`
// section of lib/system-prompt.ts tells the model how to use the `[id]` on
// each heading line.

const knowledge = chunks
  .map((c) => {
    const head = `[${c.id}] ${c.sourceLabel} — ${c.heading}`;
    return [head, c.meta, ...c.lines.map((l) => `- ${l}`)].filter(Boolean).join("\n");
  })
  .join("\n\n");

// JSON.stringify rather than a template literal, so backticks, `${` and
// backslashes in the markdown need no hand-escaping.
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
if (heldBack.length) {
  console.log(
    `[build-knowledge] held back ${heldBack.length} chunk(s) with an unresolved marker: ${heldBack
      .map((c) => c.id)
      .join(", ")}`,
  );
}
