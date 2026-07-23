import { ChatLauncherInput } from "@/components/chat/chat-launcher-input";

// Dark ink bar — the contrast treatment makes it read as the site's chat
// entry point rather than blending into the page chrome. On /chat it is
// hidden (via HideOnChat in the layout) and the chat page renders its own
// input in the identical position, so the bar appears to "become" the chat.
export function StickyChatBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-ink bg-ink px-6 md:px-12">
      <ChatLauncherInput className="h-11" />
    </div>
  );
}
