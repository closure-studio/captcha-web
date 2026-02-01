/**
 * 验证码相关类型定义
 */
import type { GeeTest4Instance } from "./geetest4.d.ts";
import type { RecognizeResult } from "../core/recognizers";
import type { CaptchaInfo } from "./type.ts";
import type { ISolveStrategy } from "../core/strategies";

/**
 * GeeTestV4Captcha 组件 Props
 */
export interface GeeTestV4CaptchaProps {
  /** 验证码类型配置 */
  captchaInfo: CaptchaInfo;
  /** 求解策略 */
  strategy: ISolveStrategy;
  /** 验证完成回调 */
  onComplete?: () => void;
}

/**
 * 验证码内部引用状态
 */
export interface CaptchaRefs {
  /** GeeTest 实例 */
  captcha: GeeTest4Instance | null;
  /** 当前识别结果ID */
  recognitionId: string | null;
  /** 当前识别结果 */
  solveResult: RecognizeResult | null;
  /** 重试次数 */
  retryCount: number;
}
