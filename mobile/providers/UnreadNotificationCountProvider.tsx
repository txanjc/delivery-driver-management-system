import type { PropsWithChildren } from "react";
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { getUnreadNotificationCountForUser } from "@/services/notification.service";

type UnreadNotificationCountState = {
  count: number | null;
  error: string | null;
  loading: boolean;
  refreshUnreadCount: () => Promise<void>;
};

export const UnreadNotificationCountContext = createContext<UnreadNotificationCountState | undefined>(undefined);

function getSafeCount(value: number | null) {
  return Math.max(0, value ?? 0);
}

export function UnreadNotificationCountProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setCount(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const request = (async () => {
      setLoading(true);

      const response = await getUnreadNotificationCountForUser(userId);

      if (response.error) {
        setCount(null);
        setError(response.error.message);
      } else {
        setCount(getSafeCount(response.count));
        setError(null);
      }

      setLoading(false);
    })().finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = request;
    return request;
  }, [userId]);

  useEffect(() => {
    setCount(null);
    setError(null);
    setLoading(false);

    if (userId) {
      void refreshUnreadCount();
    }
  }, [refreshUnreadCount, userId]);

  const value = useMemo<UnreadNotificationCountState>(
    () => ({
      count,
      error,
      loading,
      refreshUnreadCount,
    }),
    [count, error, loading, refreshUnreadCount],
  );

  return <UnreadNotificationCountContext.Provider value={value}>{children}</UnreadNotificationCountContext.Provider>;
}
