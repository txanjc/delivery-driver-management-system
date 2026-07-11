import { useContext } from "react";

import { UnreadNotificationCountContext } from "@/providers/UnreadNotificationCountProvider";

export function useUnreadNotificationCount() {
  const context = useContext(UnreadNotificationCountContext);

  if (!context) {
    throw new Error("useUnreadNotificationCount must be used within UnreadNotificationCountProvider");
  }

  return context;
}

export function formatUnreadNotificationBadge(count: number | null) {
  if (!count || count < 1) return null;
  return count > 99 ? "99+" : String(count);
}
