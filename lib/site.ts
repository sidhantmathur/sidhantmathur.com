import { DEFAULT_MODEL } from "./models.ts";

/**
 * Who the site says it is, and the one sentence it says about its own answers.
 * Imported wherever they appear, never passed as props.
 *
 * `lib/transcript.ts` is the exception: it takes its title, source URL and
 * footer as arguments and keeps its own `SITE_ORIGIN` for making links
 * absolute. It is the framework-free serializer the evals drive directly, so it
 * stays a pure function of its input and its callers pass these in.
 */

/** The name in the status strip, the page title, and a transcript's heading. */
export const SITE_NAME = "Sidhant Mathur";

/** Apex, no trailing slash — it is concatenated in the sitemap. */
export const SITE_URL = "https://sidhantmathur.com";

/**
 * How to reach him, as `content/knowledge/faq.md` lists it. Written out once:
 * the front door's CTA row, the document pages' contact block, the contact
 * panel and the Person JSON-LD all read these rather than retyping an address.
 */
export const EMAIL = "hello@sidhantmathur.com";
export const LINKEDIN_URL = "https://www.linkedin.com/in/sidhantmathur";
export const GITHUB_URL = "https://github.com/sidhantmathur";

/**
 * The headshot (1000×1000, no metadata), beside the name and role line on the
 * front door and in the Person JSON-LD. Never on /resume or in the resume PDF:
 * the resume is the document that goes into an ATS as it is.
 */
export const HEADSHOT = "/images/headshot.jpg";

/**
 * Verbatim from docs/site-copy.md. The footer of every conversation that leaves
 * the page (copied, exported or printed), since a transcript is read where the
 * site's chrome isn't. The composer's on-screen fine print is shorter copy in
 * components/shell/app-shell.tsx.
 */
export const DISCLAIMER =
  "AI-generated answers about my professional background. It can make mistakes — the resume is the authoritative version.";

/**
 * The colophon's opening paragraph, on /colophon and in the colophon panel. The
 * model is read from the catalogue so the sentence stays true when the default
 * changes.
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
