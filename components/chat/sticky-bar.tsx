"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StickyChatBar() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    // Launcher, not a second chat surface: navigate to /chat carrying the
    // typed question, which /chat reads on mount and sends as the first message.
    router.push(`/chat?q=${encodeURIComponent(q)}`);
    setValue("");
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex h-11 items-center border-t border-ink bg-surface-raised px-6 font-mono text-[13px] md:px-12">
      <span className="text-ink-soft">&gt;</span>
      <form className="flex flex-1 items-center" onSubmit={handleSubmit}>
        <input
          id="sticky-chat-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask a question about my work"
          className="ml-2 w-full flex-1 border-none bg-transparent text-ink outline-none placeholder:text-faint"
        />
      </form>
      <span className="text-faint">enter ↵</span>
    </div>
  );
}
