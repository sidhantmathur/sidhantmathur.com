import Link from "next/link";

// Primary hero CTA — a plain link to the chat page. It was previously a
// button that focused the sticky bottom bar, which read as a no-op; a
// navigation makes the affordance obvious (site-copy: "opens the chat").
export function AskAnythingButton() {
  return (
    <Link
      href="/chat"
      className="bg-ink px-5 py-3 font-sans text-sm font-medium text-paper transition-opacity hover:opacity-90"
    >
      Ask me anything
    </Link>
  );
}
