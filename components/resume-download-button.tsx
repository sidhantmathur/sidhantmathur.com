"use client";

import { track } from "@/lib/analytics";
import { RESUME_PDF, RESUME_PDF_FILENAME } from "@/lib/site";

// Bordered, not filled. The light system had this as a solid ink block, which
// the token migration turned into a slab of accent orange — far too loud for a
// system where the accent marks one thing at a time.
export function ResumeDownloadButton() {
  return (
    <a
      href={RESUME_PDF}
      download={RESUME_PDF_FILENAME}
      onClick={() => track("resume_download")}
      className="mt-6 inline-block border border-line-strong px-4 py-3 text-[14px] text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
    >
      Download PDF ↓
    </a>
  );
}
