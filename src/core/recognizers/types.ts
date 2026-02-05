import type { CaptchaType } from "../../types/api";
import type { ScreenshotResult } from "../../utils/screenshot";

/**
 * 识别结果状态码
 */
export const RecognizeCode = {
  SUCCESS: "success",
  FAILED: "failed",
} as const;

export type RecognizeCodeValue =
  (typeof RecognizeCode)[keyof typeof RecognizeCode];

/**
 * 坐标点
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 数据收集器接口
 */
export interface CaptchaCollector {
  addCapture(name: string, base64: string): void;
  setMetadata(key: string, value: unknown): void;
}

/**
 * 识别请求
 */
export interface RecognizeRequest {
  image: string;
  type: CaptchaType;
  backgroundImage?: string;
}

/**
 * 识别结果
 */
export interface RecognizeResult {
  success: boolean;
  captchaId: string;
  points: Point[];
  message: string;
  /** API 请求耗时（毫秒） */
  elapsed?: number;
}

/**
 * 报错结果
 */
export interface ReportErrorResult {
  success: boolean;
  message: string;
}

/**
 * 识别器接口
 * 只负责调用 API 识别图片，不负责 bypass
 */
export interface IRecognizer {
  readonly name: string;

  /**
   * 识别验证码
   */
  recognize(
    request: RecognizeRequest,
    collector?: CaptchaCollector,
  ): Promise<RecognizeResult>;

  /**
   * 报告识别错误
   */
  reportError(captchaId: string): Promise<ReportErrorResult>;

  /**
   * 截图
   */
  capture(containerId: string): Promise<ScreenshotResult | null>;
}
