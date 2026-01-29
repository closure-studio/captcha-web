/**
 * 验证码相关类型定义
 */
import type { GeeTest4Instance } from "./geetest4.d.ts";
import type { CaptchaSolveResult } from "../utils/captcha/type/provider.ts";
import type { CaptchaInfo } from "./type.ts";
import type { ICaptchaProvider } from "../utils/captcha/type/provider.ts";

/**
 * GeeTestV4Captcha 组件 Props
 */
export interface GeeTestV4CaptchaProps {
  /** 验证码类型配置 */
  captchaInfo: CaptchaInfo;
  /** 验证码提供者实例 */
  provider: ICaptchaProvider;
  /** 验证完成回调（包含服务器验证结果） */
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
  solveResult: CaptchaSolveResult | null;
  /** 重试次数 */
  retryCount: number;
}
