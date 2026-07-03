import type { MDXComponents } from "mdx/types";

// Maps raw MDX elements to token typography — 02-static-pages.md §2.2.
// Case-study prose (### headings, paragraphs) gets styled here so the .mdx
// content files stay plain markdown with no repeated classes.
//
// MDX `###` headings are rendered as semantic <h2> (not <h3>) so the outline
// under the case-study <h1> Title doesn't skip a level. Visual styling is
// kept identical to the original h3 treatment — this is a semantics-only
// change for accessibility (heading-order).
const components: MDXComponents = {
  h3: ({ children }) => (
    <h2 className="mt-8 font-sans text-xl font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h2>
  ),
  p: ({ children }) => (
    <p className="mt-4 max-w-[58ch] font-sans text-[15px] leading-relaxed text-ink-soft md:text-base">
      {children}
    </p>
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
