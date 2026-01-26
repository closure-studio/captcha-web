import {
  CaptchaSolveCode,
  CaptchaType,
  ProviderNames,
  type CaptchaPoint,
  type CaptchaReportErrorResult,
  type CaptchaSolveRequest,
  type CaptchaSolveResult,
  type ICaptchaProvider,
} from "../type/provider";
import { TTShituClient, TTShituTypeId, type TTShituOptions } from "./client";

/**
 * TTShitu 验证码提供者
 */
export class TTShituCaptchaProvider implements ICaptchaProvider {
  readonly name = ProviderNames.TTSHITU;
  private client: TTShituClient;
  private lastResultId: string = "";

  constructor(options?: TTShituOptions) {
    this.client = new TTShituClient(options);
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
}
