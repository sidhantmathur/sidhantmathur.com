/**
 * Who the site says it is, and the one sentence it says about its own answers.
 *
 * The name and the URL were written out in six places — the layout's metadata,
 * the sitemap, robots.txt, the shell's status strip, the copied transcript's
 * header, and the print document — and threaded as props between the last
 * three. They are a name and a URL, not prose: nothing chooses between them,
 * so nothing should be passed one.
 *
 * WHAT IS DELIBERATELY NOT HERE. `lib/transcript.ts` still takes its title,
 * source URL and footer as arguments and holds its own `SITE_ORIGIN` for
 * permalink parsing. It is the framework-free serializer the eval suite drives
 * directly, and a serializer that reaches for global config instead of reading
 * its arguments is harder to test and no shorter. The callers import from here
 * and pass them in; the module itself stays a pure function of its input.
 */

/** The name in the status strip, the page title, and a transcript's heading. */
export const SITE_NAME = "Sidhant Mathur";

/** Apex, no trailing slash — it is concatenated in the sitemap. */
export const SITE_URL = "https://sidhantmathur.com";

/**
 * Verbatim from docs/site-copy.md. Under the composer on screen, and the
 * footer of every conversation that leaves the page — the transcript is read
 * somewhere this site's chrome isn't, which is exactly where the caveat has to
 * travel with it.
 */
export const DISCLAIMER =
  "AI-generated answers about my professional background. It can make mistakes — the resume is the authoritative version.";
