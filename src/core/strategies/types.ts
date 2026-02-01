import type { RecognizeResult, CaptchaCollector } from "../recognizers";
import type { BypassResult } from "../bypass";

/**
 * 求解上下文
 */
export interface SolveContext {
  /** 外部容器 */
  container: HTMLElement;
  /** 容器 ID（用于截图） */
  containerId: string;
  /** 数据收集器 */
  collector: CaptchaCollector;
}

/**
 * 求解结果
 */
export interface SolveResult {
  /** 识别结果 */
  recognizeResult: RecognizeResult;
  /** bypass 结果 */
  bypassResult: BypassResult;
}

/**
 * 求解策略接口
 */
export interface ISolveStrategy {
  readonly type: "slide" | "click";

  /**
   * 执行验证码求解（识别 + bypass）
   */
  solve(context: SolveContext): Promise<SolveResult>;
}
