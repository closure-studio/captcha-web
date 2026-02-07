import { useEffect, useRef } from "react";
import { useCaptchaQueue } from "../hooks/useCaptchaQueue";
import { useAutoRefreshManager } from "../hooks/useAutoRefreshManager";
import { useSystemInfoManager } from "../hooks/useSystemInfoManager";
import {
  TASK_QUEUE_LENGTH,
  AUTO_REFRESH_INTERVAL,
  MAX_WAIT_TIME,
} from "../consts/consts";
import { AppContext } from "./appContext";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const queue = useCaptchaQueue({
    maxConcurrent: TASK_QUEUE_LENGTH,
  });

  const activeTaskCountRef = useRef(queue.activeTaskCount);
  const stopPollingRef = useRef(queue.stopPolling);

  useEffect(() => {
    activeTaskCountRef.current = queue.activeTaskCount;
  }, [queue.activeTaskCount]);

  useEffect(() => {
    stopPollingRef.current = queue.stopPolling;
  }, [queue.stopPolling]);

  const autoRefresh = useAutoRefreshManager({
    refreshInterval: AUTO_REFRESH_INTERVAL,
    maxWaitTime: MAX_WAIT_TIME,
    getActiveTaskCount: () => activeTaskCountRef.current,
    onStopPolling: () => stopPollingRef.current(),
  });

  const systemInfo = useSystemInfoManager();

  return (
    <AppContext.Provider value={{ ...queue, ...autoRefresh, ...systemInfo }}>
      {children}
    </AppContext.Provider>
  );
}
