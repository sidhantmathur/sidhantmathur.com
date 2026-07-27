// The two corpora, as one id space (roadmap Sprint 7, #8).
//
// The site has two bodies of evidence now: what it knows about Sidhant
// (content/knowledge/*.md → CHUNKS) and what it knows about itself (this repo →
// REPO_CHUNKS). They are built by different scripts and loaded into the prompt
// on different turns, but a CITATION should not care which one it lands in —
// the margin, the panel and the checker all just need to know whether the id
// the model wrote exists and what text sits behind it.
//
// So the lookup is merged here, once, and everything that verifies or renders a
// citation reads this module rather than picking a corpus. The alternative — a
// `repo:` branch in each of those places — is three chances to render a real
// citation as an invented one.
//
// WHAT IS NOT MERGED: the role-fit reconciler still checks its rows against the
// knowledge base alone. A row claiming Sidhant meets a requirement, evidenced by
// a comment in this site's own source, is not evidence about Sidhant.

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
