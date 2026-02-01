/**
 * Bypass 执行器类型定义
 */

/**
 * 滑动配置
 */
export interface SlideConfig {
  /** X轴偏移量校正值 */
  xOffset: number;
  /** 滑动步数 */
  slideSteps: number;
  /** 每步延迟范围（毫秒） */
  stepDelay: { min: number; max: number };
  /** 是否启用调试日志 */
  debug: boolean;
}

/**
 * 点击配置
 */
export interface ClickConfig {
  /** 点击间隔范围（毫秒） */
  delay: { min: number; max: number };
  /** 是否启用调试日志 */
  debug: boolean;
}

/**
 * GeeTest 滑块 bypass 上下文
 */
export interface GeeTestSlideBypassContext {
  container: HTMLElement;
  sliderBtn: HTMLElement;
  sliderTrack: HTMLElement;
  sliceElement: HTMLElement;
  captchaWindow: HTMLElement;
  canvasWidth: number;
}

/**
 * GeeTest 点选 bypass 上下文
 */
export interface GeeTestClickBypassContext {
  container: HTMLElement;
  captchaWindow: HTMLElement;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Bypass 执行结果
 */
export interface BypassResult {
  success: boolean;
  message: string;
}

/**
 * 坐标点
 */
export interface Point {
  x: number;
  y: number;
}
