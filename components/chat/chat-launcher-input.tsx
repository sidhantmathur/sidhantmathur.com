"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Launcher, not a second chat surface: navigates to /chat carrying the typed
// question, which /chat reads on mount and sends as the first message.
// Shared by the sticky bottom bar and the homepage chat teaser.
export function ChatLauncherInput({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/chat?q=${encodeURIComponent(q)}`);
    setValue("");
  }

  return (
    <form
      className={cn("flex items-center font-mono text-[13px]", className)}
      onSubmit={handleSubmit}
    >
      <span className="text-ink-soft">&gt;</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask a question about my work"
        className="ml-2 w-full flex-1 border-none bg-transparent text-ink outline-none placeholder:text-faint"
      />
      <span className="text-faint">enter ↵</span>
    </form>
  );
}
