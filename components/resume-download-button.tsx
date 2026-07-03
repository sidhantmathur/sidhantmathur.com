"use client";

import { track } from "@/lib/analytics";

// The Download PDF button on /resume. Client component so it can fire the
// resume_download PostHog event (safe no-op when analytics is unconfigured);
// the surrounding /resume page stays static.
export function ResumeDownloadButton() {
  return (
    <a
      href="/resume.pdf"
      download
      onClick={() => track("resume_download")}
      className="mt-6 inline-block bg-ink px-5 py-3 font-sans text-sm font-medium text-paper transition-opacity hover:opacity-90"
    >
      Download PDF
    </a>
  );
}
