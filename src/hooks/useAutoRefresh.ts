import { useContext } from "react";
import {
  AutoRefreshContext,
  type AutoRefreshContextValue,
} from "../contexts/autoRefreshContext";

export function useAutoRefresh(): AutoRefreshContextValue {
  const ctx = useContext(AutoRefreshContext);
  if (!ctx) {
    throw new Error("useAutoRefresh must be used within AutoRefreshProvider");
  }
  return ctx;
}
