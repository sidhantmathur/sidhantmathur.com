// The two corpora as one id space: what the site knows about Sidhant
// (content/knowledge/*.md → CHUNKS) and about itself (this repo → REPO_CHUNKS).
// They are built by different scripts and loaded on different turns, but a
// citation doesn't care which one it lands in. The margin, the panel and the
// checker all read this merged lookup rather than branching on `repo:`.
//
// Not merged: the role-fit reconciler checks its rows against the knowledge
// base alone. A comment in this site's source is not evidence about Sidhant.

import { CHUNKS, CHUNK_BY_ID, type Chunk } from "./chunks.generated";
import { REPO_CHUNKS, REPO_BY_ID } from "./repo.generated";

export type { Chunk };

/** Everything citable, knowledge base first. */
export const ALL_CHUNKS: Chunk[] = [...CHUNKS, ...REPO_CHUNKS];

export const ALL_CHUNKS_BY_ID: Record<string, Chunk> = {
  ...CHUNK_BY_ID,
  ...REPO_BY_ID,
};

/** True for an id that belongs to the site's own source rather than to Sidhant's record. */
export function isRepoId(id: string): boolean {
  return id.startsWith("repo:");
}
