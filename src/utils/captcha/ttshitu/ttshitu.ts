import {
  BaseCaptchaProvider,
  CaptchaSolveCode,
  CaptchaType,
  ProviderNames,
  type BypassResult,
  type CaptchaPoint,
  type CaptchaReportErrorResult,
  type CaptchaSolveRequest,
  type CaptchaSolveResult,
  type GeeTestSlideBypassContext,
} from "../type/provider";
import { TTShituClient, TTShituTypeId, type TTShituOptions } from "./client";
import {
  TTShituSlideBypass,
  type TTShituSlideBypassConfig,
} from "./slide";

/**
 * TTShitu 验证码提供者配置
 */
export interface TTShituCaptchaProviderOptions extends TTShituOptions {
  /** 滑块 bypass 配置 */
  slideBypassConfig?: TTShituSlideBypassConfig;
}

/**
 * TTShitu 验证码提供者
 * 继承 BaseCaptchaProvider 以复用通用的 bypass 方法（如 bypassGeeTestClick）
 * 重写 bypassGeeTestSlide 以使用专用的滑块 bypass 逻辑
 */
export class TTShituCaptchaProvider extends BaseCaptchaProvider {
  readonly name = ProviderNames.TTSHITU;
  private client: TTShituClient;
  private lastResultId: string = "";
  private slideBypass: TTShituSlideBypass;

  constructor(options?: TTShituCaptchaProviderOptions) {
    super();
    this.client = new TTShituClient(options);
    this.slideBypass = new TTShituSlideBypass(options?.slideBypassConfig);
  }

  async solve(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
    try {
      let result: { result: string; id: string };
      let points: CaptchaPoint[];

      if (request.type === CaptchaType.SLIDE) {
        // 滑块验证码
        result = await this.client.predict(
          request.image,
          TTShituTypeId.GAP_SINGLE_X,
        );
        const x = parseInt(result.result, 10);
        if (isNaN(x)) {
          throw new Error(`Invalid slide result: ${result.result}`);
        }
        points = [{ x, y: 0 }];
      } else {
        // 点选验证码 - 默认使用 CLICK_3_5
        result = await this.client.predict(
          request.image,
          TTShituTypeId.CLICK_3_5,
        );
        // TTShitu 点选返回格式: "x1,y1|x2,y2|x3,y3"
        points = this.parseClickPoints(result.result);
      }

      this.lastResultId = result.id;

      return {
        message: "success",
        code: CaptchaSolveCode.SUCCESS,
        data: {
          captchaId: result.id,
          points,
        },
      };
    } catch (error) {
      return {
        message: error instanceof Error ? error.message : "Unknown error",
        code: CaptchaSolveCode.FAILED,
        data: {
          captchaId: "",
          points: [],
        },
      };
    }
  }

  /**
   * 解析 TTShitu 点选结果
   * @param result 格式: "x1,y1|x2,y2|x3,y3"
   */
  private parseClickPoints(result: string): CaptchaPoint[] {
    return result.split("|").map((point) => {
      const [x, y] = point.split(",").map((v) => parseFloat(v.trim()));
      return { x: x || 0, y: y || 0 };
    });
  }

  async reportError(captchaId: string): Promise<CaptchaReportErrorResult> {
    try {
      const result = await this.client.reportError(
        captchaId || this.lastResultId,
      );
      return {
        success: true,
        message: result.result,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 执行 GeeTest 滑块验证码 bypass
   * 重写父类方法，使用专用的 TTShituSlideBypass 处理
   */
  async bypassGeeTestSlide(
    context: GeeTestSlideBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult> {
    return this.slideBypass.execute(context, solveResult);
  }

  // bypassGeeTestClick 直接继承自 BaseCaptchaProvider，无需重写
}
