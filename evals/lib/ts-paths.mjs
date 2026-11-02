// Lets `node --test` import a file that uses the app's own import style: the
// `@/` alias from tsconfig.json, and TypeScript imports with no extension
// (`./models`), which Next's bundler resolves and plain Node does not. Every
// other eval imports lib/ files that name their dependencies as `./x.ts` on
// purpose; this is for the few that have to load something written for the
// bundler, such as the chat route itself.
//
// A synchronous resolve hook (node:module registerHooks), registered when this
// module is imported, so the test file must import it before any dynamic
// import of a bundler-style file. Each test file runs in its own process, so
// the hook never reaches another suite.

import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const CANDIDATES = (base) => [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];

function resolveTs(base) {
  for (const candidate of CANDIDATES(base)) {
    if (existsSync(candidate) && statSync(candidate).isFile() && /\.tsx?$/.test(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;
    if (specifier.startsWith("@/")) {
      base = path.join(ROOT, specifier.slice(2));
    } else if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:") &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    const url = base && resolveTs(base);
    return url ? nextResolve(url, context) : nextResolve(specifier, context);
  },
});

/** Imports a repo file by its path from the root, through the hook above. */
export function importFromRoot(relative) {
  return import(pathToFileURL(path.join(ROOT, relative)).href);
}
