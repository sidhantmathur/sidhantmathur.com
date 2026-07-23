"use client";

import { usePathname } from "next/navigation";

// Hides layout chrome (footer, sticky launcher bar) on /chat, where the chat
// page pins its own input to the bottom of the viewport and a trailing footer
// would float mid-conversation. Children stay server-rendered; only the
// show/hide decision is client-side.
export function HideOnChat({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/chat") return null;
  return <>{children}</>;
}
