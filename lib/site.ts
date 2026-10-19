import { DEFAULT_MODEL } from "./models.ts";

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

/**
 * The colophon's opening paragraph, on /colophon and in the colophon panel.
 *
 * It used to say the chat "runs on Claude", which stopped being true when the
 * default moved to DeepSeek in August — on the one page whose job is to be
 * exact about how the site works. The model is read from the catalogue now, so
 * the sentence is true whichever model is the default the day it is read.
 */
export const COLOPHON_STACK = `Next.js, TypeScript, and Tailwind, deployed on Vercel. Type is Geist Sans and Geist Mono. The chat assistant runs through Vercel's AI Gateway on ${DEFAULT_MODEL} by default, with the knowledge base injected directly into the prompt — at this scale, a vector database would be complexity for its own sake, so there isn't one.`;

/** The resume PDF, as every link on the site writes it. */
export const RESUME_PDF = "/resume.pdf";

/**
 * What the resume saves as. The file is served as `resume.pdf`, which lands in
 * a recruiter's downloads folder, and then in an ATS, as one more resume.pdf
 * among hundreds. The name is the person's, so it says whose it is.
 */
export const RESUME_PDF_FILENAME = "Sidhant_Mathur_Resume.pdf";

/**
 * The `download` attribute for an anchor, when it points at the resume PDF —
 * spread into every anchor that can, so a link the model wrote in an answer
 * saves under the same name as the button on /resume.
 */
export function downloadAs(href: string | undefined): { download?: string } {
  return href === RESUME_PDF ? { download: RESUME_PDF_FILENAME } : {};
}
