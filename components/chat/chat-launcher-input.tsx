"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Launcher, not a second chat surface: navigates to /chat carrying the typed
// question, which /chat reads on mount and sends as the first message.
// Used only by the sticky bottom bar (dark ink treatment) — the single
// free-text chat entry point outside /chat itself.
export function ChatLauncherInput({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function send() {
    const q = value.trim();
    if (!q) return;
    router.push(`/chat?q=${encodeURIComponent(q)}`);
    setValue("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send();
  }

  return (
    <form
      className={cn("flex items-center font-mono text-[13px]", className)}
      onSubmit={handleSubmit}
    >
      <span className="text-rubric">&gt;</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        // Explicit Enter handling — implicit form submission is skipped by
        // some input methods (IMEs, automation, some mobile keyboards).
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Ask a question about my work"
        className="ml-2 w-full flex-1 border-none bg-transparent text-paper outline-none placeholder:text-band-muted"
      />
      <span className="text-band-muted">enter ↵</span>
      {/* Guarantees implicit Enter-to-submit across browsers/input methods. */}
      <button type="submit" hidden aria-hidden tabIndex={-1} />
    </form>
  );
}
