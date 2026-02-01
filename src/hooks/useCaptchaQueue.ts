import { useState, useEffect, useRef, useCallback } from "react";
import type { CaptchaTask, CaptchaResultStatus, SubmitResultRequest } from "../types/api";
import { captchaTaskApi } from "../utils/api/captchaTaskApi";
import { createModuleLogger } from "../utils/logger";

const logger = createModuleLogger("useCaptchaQueue");

export interface UseCaptchaQueueOptions {
  // 是否自动轮询获取新任务
  autoFetch?: boolean;
  // 轮询间隔（毫秒）
  pollInterval?: number;
  // 单个任务超时时间（毫秒）
  taskTimeout?: number;
  // 最大并发任务数
  maxConcurrent?: number;
  // 是否使用mock数据
  useMock?: boolean;
}

export interface UseCaptchaQueueReturn {
  // 当前任务列表
  tasks: CaptchaTask[];
  // 是否正在加载
  isLoading: boolean;
  // 错误信息
  error: string | null;
  // 手动获取新任务
  fetchTasks: () => Promise<void>;
  // 完成任务（成功或失败）
  completeTask: (
    containerId: string,
    status: CaptchaResultStatus,
    result?: Record<string, unknown>,
    errorMessage?: string
  ) => Promise<void>;
  // 移除任务（不上报结果）
  removeTask: (containerId: string) => void;
  // 开始轮询
  startPolling: () => void;
  // 停止轮询
  stopPolling: () => void;
  // 是否正在轮询
  isPolling: boolean;
}

const DEFAULT_OPTIONS: Required<UseCaptchaQueueOptions> = {
  autoFetch: true, // 默认自动轮询
  pollInterval: 10000, // 10秒轮询一次
  taskTimeout: 2 * 60 * 1000, // 2分钟超时
  maxConcurrent: 4,
  useMock: true, // 开发阶段默认使用mock
};

export function useCaptchaQueue(
  options: UseCaptchaQueueOptions = {}
): UseCaptchaQueueReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [tasks, setTasks] = useState<CaptchaTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // 持久化定时器引用
  const pollTimerRef = useRef<number | null>(null);
  const timeoutMapRef = useRef(new Map<string, number>());
  const taskStartTimeRef = useRef(new Map<string, number>());

  // 使用 ref 保存 tasks 以避免 stale closure
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // 更新API配置
  useEffect(() => {
    captchaTaskApi.updateConfig({ useMock: opts.useMock });
  }, [opts.useMock]);

  // 清除任务超时
  const clearTaskTimeout = useCallback((containerId: string) => {
    const timeout = timeoutMapRef.current.get(containerId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutMapRef.current.delete(containerId);
    }
  }, []);

  // 完成任务 - 使用 ref 来获取最新的 tasks
  const completeTask = useCallback(
    async (
      containerId: string,
      status: CaptchaResultStatus,
      result?: Record<string, unknown>,
      errorMessage?: string
    ) => {
      const task = tasksRef.current.find((t) => t.containerId === containerId);
      if (!task) {
        logger.warn(`找不到任务: ${containerId}`);
        return;
      }

      // 计算耗时
      const startTime = taskStartTimeRef.current.get(containerId);
      const duration = startTime ? Date.now() - startTime : undefined;

      // 清除超时定时器
      clearTaskTimeout(containerId);
      taskStartTimeRef.current.delete(containerId);

      // 从列表中移除
      setTasks((prev) => prev.filter((t) => t.containerId !== containerId));

      // 上报结果到服务器
      try {
        const response = await captchaTaskApi.submitResult({
          taskId: task.taskId,
          containerId,
          status,
          result: result as SubmitResultRequest["result"],
          errorMessage,
          duration,
        });

        if (response.success) {
          logger.info(`任务结果已上报: ${task.taskId}, 状态: ${status}`);
        } else {
          logger.error(`任务结果上报失败: ${response.message}`);
        }
      } catch (err) {
        logger.error("上报任务结果异常:", err);
      }
    },
    [clearTaskTimeout]
  );

  // 使用 ref 保存 completeTask 以避免循环依赖
  const completeTaskRef = useRef(completeTask);
  completeTaskRef.current = completeTask;

  // 为任务设置超时
  const setTaskTimeout = useCallback(
    (containerId: string) => {
      if (timeoutMapRef.current.has(containerId)) return;

      const timeout = window.setTimeout(() => {
        logger.warn(`任务超时: ${containerId}`);
        // 超时时自动完成任务
        completeTaskRef.current(containerId, "timeout");
      }, opts.taskTimeout);

      timeoutMapRef.current.set(containerId, timeout);
      taskStartTimeRef.current.set(containerId, Date.now());
    },
    [opts.taskTimeout]
  );

  // 获取新任务
  const fetchTasks = useCallback(async () => {
    // 如果已达到最大并发数，不再获取新任务
    if (tasksRef.current.length >= opts.maxConcurrent) {
      logger.info(`已达到最大并发数 ${opts.maxConcurrent}，暂不获取新任务`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await captchaTaskApi.fetchTasks();

      if (response.success) {
        const newTasks = response.data;
        if (newTasks.length > 0) {
          logger.info(`获取到 ${newTasks.length} 个新任务`);
          setTasks((prev) => {
            // 过滤掉已存在的任务
            const existingIds = new Set(prev.map((t) => t.taskId));
            const uniqueNewTasks = newTasks.filter((t) => !existingIds.has(t.taskId));

            // 限制总数不超过maxConcurrent
            const availableSlots = opts.maxConcurrent - prev.length;
            const tasksToAdd = uniqueNewTasks.slice(0, availableSlots);

            return [...prev, ...tasksToAdd];
          });
        }
      } else {
        setError(response.message || "获取任务失败");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      logger.error("获取任务异常:", err);
    } finally {
      setIsLoading(false);
    }
  }, [opts.maxConcurrent]);

  // 移除任务（不上报结果）
  const removeTask = useCallback(
    (containerId: string) => {
      clearTaskTimeout(containerId);
      taskStartTimeRef.current.delete(containerId);
      setTasks((prev) => prev.filter((t) => t.containerId !== containerId));
    },
    [clearTaskTimeout]
  );

  // 使用 ref 保存 fetchTasks 以供轮询使用
  const fetchTasksRef = useRef(fetchTasks);
  fetchTasksRef.current = fetchTasks;

  // 开始轮询
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;

    setIsPolling(true);
    logger.info("开始轮询任务");

    // 立即获取一次
    fetchTasksRef.current();

    // 设置轮询
    pollTimerRef.current = window.setInterval(() => {
      fetchTasksRef.current();
    }, opts.pollInterval);
  }, [opts.pollInterval]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
    logger.info("停止轮询任务");
  }, []);

  // 监听任务列表变化，为新任务设置超时
  useEffect(() => {
    tasks.forEach((task) => {
      setTaskTimeout(task.containerId);
    });

    // 清理已移除任务的定时器
    const currentTimeoutMap = timeoutMapRef.current;
    currentTimeoutMap.forEach((_, containerId) => {
      if (!tasks.some((t) => t.containerId === containerId)) {
        clearTaskTimeout(containerId);
        taskStartTimeRef.current.delete(containerId);
      }
    });
  }, [tasks, setTaskTimeout, clearTaskTimeout]);

  // 自动获取（如果启用）
  useEffect(() => {
    if (opts.autoFetch) {
      startPolling();
    }
    return () => {
      stopPolling();
    };
  }, [opts.autoFetch, startPolling, stopPolling]);

  // 清理
  useEffect(() => {
    const currentTimeoutMap = timeoutMapRef.current;
    const currentStartTimeMap = taskStartTimeRef.current;

    return () => {
      // 清理所有定时器
      currentTimeoutMap.forEach((timeout) => clearTimeout(timeout));
      currentTimeoutMap.clear();
      currentStartTimeMap.clear();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  return {
    tasks,
    isLoading,
    error,
    fetchTasks,
    completeTask,
    removeTask,
    startPolling,
    stopPolling,
    isPolling,
  };
}
