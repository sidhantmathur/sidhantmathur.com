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
    <h2 className="mt-8 text-[15px] font-medium tracking-tight text-text first:mt-0">
      {children}
    </h2>
  ),
  p: ({ children }) => (
    <p className="mt-3 max-w-[68ch] text-[13px] leading-[1.7] text-text-soft">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mt-3 max-w-[68ch] list-disc space-y-1.5 pl-4 text-[13px] leading-[1.7] text-text-soft marker:text-text-faint">
      {children}
    </ul>
  ),
  strong: ({ children }) => (
    <strong className="font-medium text-text">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      {...(href?.startsWith("/") ? {} : { target: "_blank", rel: "noreferrer" })}
      className="text-text underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
    >
      {children}
    </a>
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
