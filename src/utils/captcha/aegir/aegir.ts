import {
  BaseCaptchaProvider,
  CaptchaSolveCode,
  ProviderNames,
  type CaptchaReportErrorResult,
  type CaptchaSolveRequest,
  type CaptchaSolveResult,
} from "../type/provider";
import { AegirClient, type AegirOptions } from "./client";

/**
 * Aegir 验证码提供者
 * 继承 BaseCaptchaProvider 以复用通用的 bypass 方法
 */
export class AegirCaptchaProvider extends BaseCaptchaProvider {
  readonly name = ProviderNames.AEGIR;
  private client: AegirClient;

  constructor(options?: AegirOptions) {
    super();
    this.client = new AegirClient(options);
  }

  async solve(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
    try {
      const response = await this.client.selectCaptcha(request.image);
      const points = this.client.parsePoints(response.data.points);

      return {
        message: response.message,
        code: CaptchaSolveCode.SUCCESS,
        data: {
          captchaId: response.data.captcha_id,
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

  async reportError(_captchaId: string): Promise<CaptchaReportErrorResult> {
    // Aegir 目前不支持报错接口，保留参数以符合接口定义
    void _captchaId;
    return {
      success: false,
      message: "Aegir does not support error reporting",
    };
  }
}
