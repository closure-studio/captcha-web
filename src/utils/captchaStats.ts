/**
 * 验证码任务统计
 */

import type { CaptchaResultStatus } from "../types/api";

export interface CaptchaStatsData {
  total: number;
  success: number;
  failed: number;
  timeout: number;
  error: number;
  avgDuration: number; // 平均耗时(ms)
}

interface StatsRecord {
  success: number;
  failed: number;
  timeout: number;
  error: number;
  totalDuration: number;
  count: number; // 有效耗时记录数
}

const stats: StatsRecord = {
  success: 0,
  failed: 0,
  timeout: 0,
  error: 0,
  totalDuration: 0,
  count: 0,
};

// 变更通知回调
type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * 记录任务结果
 */
export function recordCaptchaResult(
  status: CaptchaResultStatus,
  duration?: number
): void {
  switch (status) {
    case "success":
      stats.success += 1;
      break;
    case "failed":
      stats.failed += 1;
      break;
    case "timeout":
      stats.timeout += 1;
      break;
    case "error":
      stats.error += 1;
      break;
  }

  // 记录耗时（超时的耗时不计入平均）
  if (duration !== undefined && status !== "timeout") {
    stats.totalDuration += duration;
    stats.count += 1;
  }

  listeners.forEach((fn) => fn());
}

/**
 * 获取统计数据
 */
export function getCaptchaStats(): CaptchaStatsData {
  const total = stats.success + stats.failed + stats.timeout + stats.error;
  return {
    total,
    success: stats.success,
    failed: stats.failed,
    timeout: stats.timeout,
    error: stats.error,
    avgDuration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0,
  };
}

/**
 * 重置统计
 */
export function resetCaptchaStats(): void {
  stats.success = 0;
  stats.failed = 0;
  stats.timeout = 0;
  stats.error = 0;
  stats.totalDuration = 0;
  stats.count = 0;
  listeners.forEach((fn) => fn());
}

/**
 * 订阅统计变化
 */
export function subscribeCaptchaStats(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
