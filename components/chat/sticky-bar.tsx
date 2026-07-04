import { ChatLauncherInput } from "@/components/chat/chat-launcher-input";

export function StickyChatBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-ink bg-surface-raised px-6 md:px-12">
      <ChatLauncherInput className="h-11" />
    </div>
  );
}
