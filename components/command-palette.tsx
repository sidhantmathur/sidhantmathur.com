"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type NavEntry = {
  label: string;
  href: string;
};

// Fired by CommandPaletteTrigger (header "Menu" button) to open the palette
// without prop-drilling through the layout.
export const OPEN_COMMAND_PALETTE_EVENT = "open-command-palette";

const NAV_ENTRIES: NavEntry[] = [
  { label: "Home", href: "/" },
  { label: "A Darle 20", href: "/projects/adarle20" },
  { label: "Reporting tools at Nokia", href: "/projects/nokia" },
  { label: "Sales prediction at Dell", href: "/projects/dell-ml" },
  { label: "Resume", href: "/resume" },
  { label: "Colophon", href: "/colophon" },
  { label: "Chat", href: "/chat" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
    };
  }, []);

  const runNavigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const runAskQuestion = useCallback(() => {
    setOpen(false);
    // Navigate to the chat page rather than focusing the sticky bar — the
    // dialog restores focus to its trigger on close, which silently undid the
    // focus, and navigation is the obvious behavior anyway.
    router.push("/chat");
  }, [router]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to a page or ask a question"
      className="rounded-none! border border-ink bg-popover text-popover-foreground shadow-none ring-0 font-mono"
    >
      <Command className="rounded-none! bg-popover text-popover-foreground">
        <CommandList className="rounded-none">
          <CommandEmpty className="font-mono text-[13px] text-faint">
            No results found.
          </CommandEmpty>
          <CommandGroup
            heading="Go to"
            className="text-muted [&_[cmdk-group-heading]]:normal-case [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-faint"
          >
            {NAV_ENTRIES.map((entry) => (
              <CommandItem
                key={entry.href}
                value={entry.label}
                onSelect={() => runNavigate(entry.href)}
                className="rounded-none! font-mono text-[13px] text-ink data-selected:bg-surface data-selected:text-ink"
              >
                {entry.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup
            heading="Chat"
            className="text-muted [&_[cmdk-group-heading]]:normal-case [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-faint"
          >
            <CommandItem
              value="Ask a question"
              onSelect={runAskQuestion}
              className="rounded-none! font-mono text-[13px] text-ink data-selected:bg-surface data-selected:text-ink"
            >
              Ask a question
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
