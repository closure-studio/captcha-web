import { createContext } from "react";

export interface AutoRefreshContextValue {
  refreshCountdown: number;
  isPreparingRefresh: boolean;
  triggerRefresh: () => void;
}

export const AutoRefreshContext = createContext<AutoRefreshContextValue | null>(
  null,
);
