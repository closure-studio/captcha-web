import { createContext, useContext } from "react";
import type { UseCaptchaQueueReturn } from "../hooks/useCaptchaQueue";
import type { SystemInfoContextValue } from "../hooks/useSystemInfoManager";

export interface AutoRefreshContextValue {
  refreshCountdown: number;
  isPreparingRefresh: boolean;
  triggerRefresh: () => void;
}

export interface AppContextValue
  extends UseCaptchaQueueReturn,
    AutoRefreshContextValue,
    SystemInfoContextValue {}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return ctx;
}
