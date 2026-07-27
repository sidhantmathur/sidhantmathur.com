"use client";

import { track } from "@/lib/analytics";

// Bordered, not filled. The light system had this as a solid ink block, which
// the token migration turned into a slab of accent orange — far too loud for a
// system where the accent marks one thing at a time.
export function ResumeDownloadButton() {
  return (
    <a
      href="/resume.pdf"
      onClick={() => track("resume_download")}
      className="mt-6 inline-block border border-line-strong px-3 py-2 text-[12px] text-text-soft no-underline transition-colors hover:border-accent hover:text-accent"
    >
      Download PDF ↓
    </a>
  );
}
