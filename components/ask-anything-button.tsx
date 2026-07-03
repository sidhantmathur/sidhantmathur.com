"use client";

export function AskAnythingButton() {
  return (
    <button
      type="button"
      onClick={() => {
        document.getElementById("sticky-chat-input")?.focus();
      }}
      className="bg-ink px-5 py-3 font-sans text-sm font-medium text-paper transition-opacity hover:opacity-90"
    >
      Ask me anything
    </button>
  );
}
