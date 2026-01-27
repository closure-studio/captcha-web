/**
 * 验证码相关常量配置
 */

// 最大重试次数
export const MAX_RETRY_COUNT = 5;

// 延迟时间配置 (毫秒)
export const CAPTCHA_DELAYS = {
  /** 截图前等待时间 */
  SCREENSHOT: 1000,
  /** 自动点击延迟 */
  AUTO_CLICK: 1000,
  /** 图片加载等待时间 */
  IMAGE_LOAD: 2000,
  /** 重试等待时间 */
  RETRY_WAIT: 3000,
} as const;

// 验证码状态类型
export type CaptchaStatus = "idle" | "solving" | "validating" | "success" | "error" | "retrying";

// 状态样式配置
export interface StatusStyle {
  /** 背景色类名 */
  bg: string;
  /** 文字色类名 */
  text: string;
  /** 加载动画边框色类名 */
  spinner?: string;
}

// 状态样式映射
export const STATUS_STYLES: Record<Exclude<CaptchaStatus, "idle">, StatusStyle> = {
  solving: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    spinner: "border-blue-500",
  },
  retrying: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    spinner: "border-orange-500",
  },
  validating: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    spinner: "border-amber-500",
  },
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  error: {
    bg: "bg-red-50",
    text: "text-red-700",
  },
};
