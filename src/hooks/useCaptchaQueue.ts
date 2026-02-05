import { useState, useEffect, useRef, useCallback } from "react";
import type {
  CaptchaTask,
  CaptchaResultStatus,
  TaskQueue,
  TaskSlot,
} from "../types/api";
import { TASK_QUEUE_LENGTH } from "../types/api";
import { captchaTaskApi } from "../utils/api/captchaTaskApi";
import { recordCaptchaResult } from "../utils/captchaStats";
import { createModuleLogger } from "../utils/logger";

const logger = createModuleLogger("useCaptchaQueue");

// 创建固定长度的空任务队列
function createEmptyTaskQueue(): TaskQueue {
  return Array(TASK_QUEUE_LENGTH).fill(null) as TaskQueue;
}

export interface UseCaptchaQueueOptions {
  // 是否自动轮询获取新任务
  autoFetch?: boolean;
  // 轮询间隔（毫秒）
  pollInterval?: number;
  // 单个任务超时时间（毫秒）
  taskTimeout?: number;
  // 最大并发任务数（不超过 TASK_QUEUE_LENGTH）
  maxConcurrent?: number;
}

export interface UseCaptchaQueueReturn {
  // 当前任务队列（固定长度 16）
  tasks: TaskQueue;
  // 是否正在加载
  isLoading: boolean;
  // 错误信息
  error: string | null;
  // 手动获取新任务
  fetchTasks: () => Promise<void>;
  // 标记任务完成（只更新本地状态，不上报 API）
  completeTask: (containerId: string, status: CaptchaResultStatus) => void;
  // 移除任务（设为 null）
  removeTask: (containerId: string) => void;
  // 开始轮询
  startPolling: () => void;
  // 停止轮询
  stopPolling: () => void;
  // 是否正在轮询
  isPolling: boolean;
  // 获取活跃任务数（未完成的）
  activeTaskCount: number;
}

const DEFAULT_OPTIONS: Required<UseCaptchaQueueOptions> = {
  autoFetch: true, // 默认自动轮询
  pollInterval: 10000, // 10秒轮询一次
  taskTimeout: 2 * 60 * 1000, // 2分钟超时
  maxConcurrent: TASK_QUEUE_LENGTH, // 默认最大为队列长度
};

// 已完成任务保留时间（毫秒），超过后清理以释放槽位
const COMPLETED_TASK_RETENTION_MS = 30 * 1000; // 30秒

export function useCaptchaQueue(
  options: UseCaptchaQueueOptions = {},
): UseCaptchaQueueReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  // 确保 maxConcurrent 不超过队列长度
  const maxConcurrent = Math.min(opts.maxConcurrent, TASK_QUEUE_LENGTH);

  const [tasks, setTasks] = useState<TaskQueue>(createEmptyTaskQueue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // 持久化定时器引用
  const pollTimerRef = useRef<number | null>(null);
  const timeoutMapRef = useRef(new Map<string, number>());
  const taskStartTimeRef = useRef(new Map<string, number>());
  // 记录任务完成时间，用于清理
  const taskCompletedTimeRef = useRef(new Map<string, number>());

  // 使用 ref 保存 tasks 以避免 stale closure
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // 清除任务超时
  const clearTaskTimeout = useCallback((containerId: string) => {
    const timeout = timeoutMapRef.current.get(containerId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutMapRef.current.delete(containerId);
    }
  }, []);

  // 标记任务完成 - 只更新本地状态，API 上报在 GeetestV4Captcha 内完成
  const completeTask = useCallback(
    (containerId: string, status: CaptchaResultStatus) => {
      const task = tasksRef.current.find(
        (t): t is CaptchaTask => t !== null && t.containerId === containerId,
      );
      if (!task) {
        logger.warn(`找不到任务: ${containerId}`);
        return;
      }

      // 如果已经标记为完成，直接返回
      if (task.completed) {
        logger.warn(`任务已完成: ${containerId}`);
        return;
      }

      // 清除超时定时器
      clearTaskTimeout(containerId);
      taskStartTimeRef.current.delete(containerId);

      // 标记为已完成并记录完成时间
      const completedTime = Date.now();
      taskCompletedTimeRef.current.set(containerId, completedTime);
      setTasks(
        (prev) =>
          prev.map((t) =>
            t !== null && t.containerId === containerId
              ? { ...t, completed: true }
              : t,
          ) as TaskQueue,
      );

      logger.info(`任务本地状态已更新: ${task.taskId} (${status})`);
    },
    [clearTaskTimeout],
  );

  // 使用 ref 保存 completeTask 以避免循环依赖
  const completeTaskRef = useRef(completeTask);
  completeTaskRef.current = completeTask;

  // 为任务设置超时
  const setTaskTimeout = useCallback(
    (containerId: string) => {
      if (timeoutMapRef.current.has(containerId)) return;

      const timeout = window.setTimeout(async () => {
        logger.warn(`任务超时: ${containerId}`);

        // 获取任务信息用于上报
        const task = tasksRef.current.find(
          (t): t is CaptchaTask => t !== null && t.containerId === containerId,
        );

        // 超时时自动完成任务（本地状态）
        completeTaskRef.current(containerId, "timeout");

        // 上报超时结果到服务器
        if (task) {
          const startTime = taskStartTimeRef.current.get(containerId);
          const duration = startTime
            ? Date.now() - startTime
            : opts.taskTimeout;

          // 记录统计数据
          recordCaptchaResult("timeout", duration);

          try {
            const response = await captchaTaskApi.submitResult({
              taskId: task.taskId,
              status: "timeout",
              duration,
              errorMessage: "任务超时",
              challenge: task.challenge,
              geetestId: task.geetestId,
              provider: task.provider,
              captchaType: task.type,
              riskType: task.riskType,
            });
            if (response.success) {
              logger.info(`超时任务已上报: ${task.taskId}`);
            } else {
              logger.error(`超时任务上报失败: ${response.message}`);
            }
          } catch (err) {
            logger.error("上报超时任务异常:", err);
          }
        }
      }, opts.taskTimeout);

      timeoutMapRef.current.set(containerId, timeout);
      taskStartTimeRef.current.set(containerId, Date.now());
    },
    [opts.taskTimeout],
  );

  // 获取新任务
  const fetchTasks = useCallback(async () => {
    // 计算活跃任务数（非 null 且未完成）
    const activeTaskCount = tasksRef.current.filter(
      (t): t is CaptchaTask => t !== null && !t.completed,
    ).length;

    // 如果已达到最大并发数，不再获取新任务
    if (activeTaskCount >= maxConcurrent) {
      return;
    }

    // 计算可用槽位数（空槽位或已完成的任务）
    const availableSlots = tasksRef.current.filter(
      (t) => t === null || t.completed,
    ).length;

    // 计算需要获取的任务数：取剩余可用槽位和（最大并发数 - 活跃任务数）中的较小值
    const slotsNeeded = Math.max(0, maxConcurrent - activeTaskCount);
    const limit = Math.min(availableSlots, slotsNeeded);

    // 如果没有可用槽位，不获取新任务
    if (limit <= 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await captchaTaskApi.fetchTasks(limit);

      if (response.success) {
        const newTasks = response.data || [];
        if (newTasks.length > 0) {
          setTasks((prev) => {
            // 获取已存在的活跃任务 ID
            const existingIds = new Set(
              prev
                .filter((t): t is CaptchaTask => t !== null && !t.completed)
                .map((t) => t.taskId),
            );
            // 过滤掉已存在的任务
            const uniqueNewTasks = newTasks.filter(
              (t) => !existingIds.has(t.taskId),
            );

            if (uniqueNewTasks.length === 0) {
              return prev;
            }

            // 从头开始遍历，找空槽位（null 或 completed）填入新任务
            const result = [...prev] as TaskSlot[];
            let taskIndex = 0;

            for (
              let i = 0;
              i < TASK_QUEUE_LENGTH && taskIndex < uniqueNewTasks.length;
              i++
            ) {
              const slot = result[i];
              // 槽位为空或任务已完成，可以放入新任务
              if (slot === null || slot.completed) {
                // 检查是否超过最大并发数
                const currentActive = result.filter(
                  (t): t is CaptchaTask => t !== null && !t.completed,
                ).length;
                if (currentActive >= maxConcurrent) {
                  break;
                }
                result[i] = uniqueNewTasks[taskIndex];
                taskIndex++;
              }
            }

            return result as TaskQueue;
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
  }, [maxConcurrent]);

  // 移除任务（设为 null）
  const removeTask = useCallback(
    (containerId: string) => {
      clearTaskTimeout(containerId);
      taskStartTimeRef.current.delete(containerId);
      setTasks(
        (prev) =>
          prev.map((t) =>
            t !== null && t.containerId === containerId ? null : t,
          ) as TaskQueue,
      );
    },
    [clearTaskTimeout],
  );

  // 使用 ref 保存 fetchTasks 以供轮询使用
  const fetchTasksRef = useRef(fetchTasks);
  fetchTasksRef.current = fetchTasks;

  // 开始轮询
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;

    setIsPolling(true);

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
  }, []);

  // 监听任务列表变化，为新任务设置超时
  useEffect(() => {
    tasks.forEach((task) => {
      if (task !== null && !task.completed) {
        setTaskTimeout(task.containerId);
      }
    });

    // 清理已移除任务的定时器
    const currentTimeoutMap = timeoutMapRef.current;
    currentTimeoutMap.forEach((_, containerId) => {
      const exists = tasks.some(
        (t) => t !== null && t.containerId === containerId,
      );
      if (!exists) {
        clearTaskTimeout(containerId);
        taskStartTimeRef.current.delete(containerId);
      }
    });
  }, [tasks, setTaskTimeout, clearTaskTimeout]);

  // 定期清理已完成的任务（设为 null 以释放槽位）
  useEffect(() => {
    const cleanupInterval = window.setInterval(() => {
      const now = Date.now();
      const completedTimeMap = taskCompletedTimeRef.current;
      const tasksToRemove: string[] = [];

      completedTimeMap.forEach((completedTime, containerId) => {
        if (now - completedTime > COMPLETED_TASK_RETENTION_MS) {
          tasksToRemove.push(containerId);
        }
      });

      if (tasksToRemove.length > 0) {
        // 将已过期的已完成任务设为 null
        setTasks(
          (prev) =>
            prev.map((t) =>
              t !== null && tasksToRemove.includes(t.containerId) ? null : t,
            ) as TaskQueue,
        );
        // 清理完成时间记录
        tasksToRemove.forEach((id) => completedTimeMap.delete(id));
        logger.info(`清理了 ${tasksToRemove.length} 个已完成的任务`);
      }
    }, 10000); // 每10秒检查一次

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

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
    const currentCompletedTimeMap = taskCompletedTimeRef.current;

    return () => {
      // 清理所有定时器
      currentTimeoutMap.forEach((timeout) => clearTimeout(timeout));
      currentTimeoutMap.clear();
      currentStartTimeMap.clear();
      currentCompletedTimeMap.clear();
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
    activeTaskCount: tasks.filter(
      (t): t is CaptchaTask => t !== null && !t.completed,
    ).length,
  };
}
