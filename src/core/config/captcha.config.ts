/**
 * 验证码配置集中管理
 */

/**
 * 滑动配置
 */
export const slideConfig = {
  /** TTShitu 滑块配置 */
  ttshitu: {
    xOffset: -10,
    slideSteps: 30,
    stepDelay: { min: 15, max: 25 },
  },
  /** Gemini 滑块配置 */
  gemini: {
    xOffset: -10,
    slideSteps: 30,
    cropConfig: {
      topCrop: 0,
      bottomCrop: 0,
    },
  },
} as const;

/**
 * 点选配置
 */
export const clickConfig = {
  delay: { min: 400, max: 600 },
} as const;

/**
 * 延迟配置（毫秒）
 */
export const delays = {
  /** 截图前等待时间 */
  screenshot: 1000,
  /** 自动点击延迟 */
  autoClick: 1000,
  /** 图片加载等待时间 */
  imageLoad: 2000,
  /** 重试等待时间 */
  retryWait: 3000,
} as const;

/**
 * 最大重试次数
 */
export const maxRetryCount = 5;

/**
 * 完整配置对象
 */
export const captchaConfig = {
  slide: slideConfig,
  click: clickConfig,
  delays,
  maxRetryCount,
} as const;

export type CaptchaConfig = typeof captchaConfig;
