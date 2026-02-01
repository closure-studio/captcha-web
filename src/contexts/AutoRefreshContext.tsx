import { useCallback, useEffect, useRef, useState } from "react";
import { createModuleLogger } from "../utils/logger";
import { AutoRefreshContext } from "./autoRefreshContext";

export type { AutoRefreshContextValue } from "./autoRefreshContext";

const logger = createModuleLogger("AutoRefresh");

// 等待任务完成的检查间隔（毫秒）
const WAIT_CHECK_INTERVAL = 1000;

export interface AutoRefreshProviderProps {
  children: React.ReactNode;
  /** 自动刷新间隔（毫秒） */
  refreshInterval: number;
  /** 等待任务完成的最大时间（毫秒） */
  maxWaitTime: number;
  /** 获取当前活跃任务数 */
  getActiveTaskCount: () => number;
  /** 停止轮询回调 */
  onStopPolling: () => void;
}

export function AutoRefreshProvider({
  children,
  refreshInterval,
  maxWaitTime,
  getActiveTaskCount,
  onStopPolling,
}: AutoRefreshProviderProps) {
  const [isPreparingRefresh, setIsPreparingRefresh] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(refreshInterval);

  const startTimeRef = useRef(0);
  const refreshTimerRef = useRef<number | null>(null);
  const waitTimerRef = useRef<number | null>(null);
  const waitStartTimeRef = useRef<number | null>(null);

  // 保存最新回调到 ref
  const getActiveTaskCountRef = useRef(getActiveTaskCount);
  const onStopPollingRef = useRef(onStopPolling);
  const maxWaitTimeRef = useRef(maxWaitTime);

  useEffect(() => {
    getActiveTaskCountRef.current = getActiveTaskCount;
  }, [getActiveTaskCount]);

  useEffect(() => {
    onStopPollingRef.current = onStopPolling;
  }, [onStopPolling]);

  useEffect(() => {
    maxWaitTimeRef.current = maxWaitTime;
  }, [maxWaitTime]);

  const doRefresh = useCallback(() => {
    logger.info("正在刷新页面以释放内存...");
    window.location.reload();
  }, []);

  // 用 ref 持有等待函数，解决递归自引用问题
  const waitAndRefreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    waitAndRefreshRef.current = () => {
      const currentActiveCount = getActiveTaskCountRef.current();

      if (currentActiveCount === 0) {
        doRefresh();
        return;
      }

      if (waitStartTimeRef.current) {
        const currentMaxWait = maxWaitTimeRef.current;
        const waitedTime = Date.now() - waitStartTimeRef.current;
        if (waitedTime >= currentMaxWait) {
          logger.warn(
            `等待任务完成超时（${currentMaxWait / 1000}秒），强制刷新`,
          );
          doRefresh();
          return;
        }
      }

      logger.info(`仍有 ${currentActiveCount} 个活跃任务，继续等待...`);
      waitTimerRef.current = window.setTimeout(
        () => waitAndRefreshRef.current(),
        WAIT_CHECK_INTERVAL,
      );
    };
  }, [doRefresh]);

  const startRefreshProcess = useCallback(() => {
    logger.info("开始准备刷新流程，停止接收新任务...");
    setIsPreparingRefresh(true);
    onStopPollingRef.current();
    waitStartTimeRef.current = Date.now();

    const count = getActiveTaskCountRef.current();
    logger.info(`等待 ${count} 个活跃任务完成...`);
    waitAndRefreshRef.current();
  }, []);

  // 设置自动刷新定时器（只在挂载时设置一次）
  useEffect(() => {
    startTimeRef.current = Date.now();

    refreshTimerRef.current = window.setTimeout(() => {
      startRefreshProcess();
    }, refreshInterval);

    const countdownInterval = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, refreshInterval - elapsed);
      setRefreshCountdown(remaining);
    }, 1000);

    logger.info(
      `已设置自动刷新定时器，${refreshInterval / 1000 / 60} 分钟后刷新`,
    );

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
      clearInterval(countdownInterval);
    };
  }, [refreshInterval, startRefreshProcess]);

  return (
    <AutoRefreshContext.Provider
      value={{
        refreshCountdown,
        isPreparingRefresh,
        triggerRefresh: startRefreshProcess,
      }}
    >
      {children}
    </AutoRefreshContext.Provider>
  );
}
