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
