/**
 * 通用工具函数
 */

/**
 * 从 Error 对象或未知类型提取错误消息
 * @param error - 错误对象
 * @param fallback - 回退消息
 * @returns 错误消息字符串
 */
export const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

import { v4 as uuidv4 } from "uuid";

/**
 * 生成随机容器ID（使用 uuid 库）
 * @returns uuid 形式的ID
 */
export const generateContainerId = (): string => {
  return uuidv4();
};
