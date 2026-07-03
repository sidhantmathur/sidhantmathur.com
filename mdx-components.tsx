import type { MDXComponents } from "mdx/types";

// Maps raw MDX elements to token typography — 02-static-pages.md §2.2.
// Case-study prose (### headings, paragraphs) gets styled here so the .mdx
// content files stay plain markdown with no repeated classes.
const components: MDXComponents = {
  h3: ({ children }) => (
    <h3 className="mt-8 font-sans text-xl font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h3>
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
