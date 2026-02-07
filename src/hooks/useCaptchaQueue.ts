import { useState, useEffect, useRef, useCallback } from "react";
import type { CaptchaTask, TaskQueue, TaskSlot } from "../types/api";
import { TASK_QUEUE_LENGTH } from "../consts/consts";
import { captchaTaskApi } from "../utils/api/captchaTaskApi";
import { createModuleLogger } from "../utils/logger";

const logger = createModuleLogger("useCaptchaQueue");

function createEmptyQueue(): TaskQueue {
  return Array(TASK_QUEUE_LENGTH).fill(null) as TaskQueue;
}

export interface UseCaptchaQueueOptions {
  pollInterval?: number;
  maxConcurrent?: number;
}

export interface UseCaptchaQueueReturn {
  tasks: TaskQueue;
  isLoading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  completeTask: (containerId: string) => void;
  startPolling: () => void;
  stopPolling: () => void;
  isPolling: boolean;
  activeTaskCount: number;
}

export function useCaptchaQueue(
  options: UseCaptchaQueueOptions = {},
): UseCaptchaQueueReturn {
  const { pollInterval = 10000, maxConcurrent = TASK_QUEUE_LENGTH } = options;
  const maxC = Math.min(maxConcurrent, TASK_QUEUE_LENGTH);

  const [tasks, setTasks] = useState<TaskQueue>(createEmptyQueue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const pollTimerRef = useRef<number | null>(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const completeTask = useCallback((containerId: string) => {
    setTasks(
      (prev) =>
        prev.map((t) =>
          t !== null && t.containerId === containerId ? null : t,
        ) as TaskQueue,
    );
    logger.info(`任务已完成: ${containerId}`);
  }, []);

  const fetchTasks = useCallback(async () => {
    const current = tasksRef.current;
    const activeCount = current.filter((t) => t !== null).length;
    const limit = Math.min(maxC - activeCount, current.filter((t) => t === null).length);
    if (limit <= 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await captchaTaskApi.fetchTasks(limit);
      if (response.success && response.data?.length) {
        setTasks((prev) => {
          const existingIds = new Set(
            prev.filter((t): t is CaptchaTask => t !== null).map((t) => t.taskId),
          );
          const newTasks = response.data!.filter((t) => !existingIds.has(t.taskId));
          if (!newTasks.length) return prev;

          const result = [...prev] as TaskSlot[];
          let idx = 0;
          for (let i = 0; i < TASK_QUEUE_LENGTH && idx < newTasks.length; i++) {
            if (result[i] === null) {
              result[i] = newTasks[idx++];
            }
          }
          return result as TaskQueue;
        });
      } else if (!response.success) {
        setError(response.message || "获取任务失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      logger.error("获取任务异常:", err);
    } finally {
      setIsLoading(false);
    }
  }, [maxC]);

  const fetchTasksRef = useRef(fetchTasks);
  fetchTasksRef.current = fetchTasks;

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    setIsPolling(true);
    fetchTasksRef.current();
    pollTimerRef.current = window.setInterval(() => fetchTasksRef.current(), pollInterval);
  }, [pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    startPolling();
    return stopPolling;
  }, [startPolling, stopPolling]);

  return {
    tasks,
    isLoading,
    error,
    fetchTasks,
    completeTask,
    startPolling,
    stopPolling,
    isPolling,
    activeTaskCount: tasks.filter((t) => t !== null).length,
  };
}
