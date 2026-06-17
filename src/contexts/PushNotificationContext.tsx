import { createContext, useContext, ReactNode } from "react";
import { usePushNotifications } from "../hooks/usePushNotifications";

interface PushNotificationContextType {
  isSubscribed: boolean;
  isLoading: boolean;
  permission: string;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  error: string | null;
}

const PushNotificationContext = createContext<PushNotificationContextType | null>(null);

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const pushState = usePushNotifications();
  return (
    <PushNotificationContext.Provider value={pushState}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotificationContext(): PushNotificationContextType {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) {
    throw new Error("usePushNotificationContext must be used within PushNotificationProvider");
  }
  return ctx;
}
