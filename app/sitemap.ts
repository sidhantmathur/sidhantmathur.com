import type { MetadataRoute } from "next";

const BASE = "https://sidhantmathur.com";

// Hand-listed rather than derived from the filesystem: there are six routes,
// they change rarely, and a generated list would also have to exclude
// /api/chat, /llms.txt and /resume.md, which is more logic than the list.
//
// No `lastModified`. A build-time `new Date()` would stamp every page as
// changed on every deploy, which is worse than no signal at all.
const ROUTES = [
  { path: "/", priority: 1 },
  { path: "/resume", priority: 0.9 },
  { path: "/projects/adarle20", priority: 0.8 },
  { path: "/projects/nokia", priority: 0.8 },
  { path: "/projects/dell-ml", priority: 0.7 },
  { path: "/colophon", priority: 0.5 },
  { path: "/measurements", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    priority,
  }));
}
