import { createModuleLogger } from "../../utils/logger";
import { recordElapsed } from "../../utils/providerStats";
import {
  captureScreenshot,
  logScreenshotPreview,
  type ScreenshotResult,
} from "../../utils/screenshot";
import { AegirClient, type AegirOptions } from "../../utils/captcha/aegir/word/client";
import type {
  IRecognizer,
  RecognizeRequest,
  RecognizeResult,
  ReportErrorResult,
} from "./types";

const logger = createModuleLogger("Aegir Recognizer");

/**
 * Aegir 识别器
 * 支持文字/图标点选验证码
 */
export class AegirRecognizer implements IRecognizer {
  readonly name = "Aegir";
  private client: AegirClient;

  constructor(options?: AegirOptions) {
    this.client = new AegirClient(options);
  }

  async recognize(request: RecognizeRequest): Promise<RecognizeResult> {
    try {
      const response = await this.client.selectCaptcha(request.image);
      const points = this.client.parsePoints(response.data.points);

      if (response.time != null) {
        recordElapsed(this.name, response.time);
      }

      if (points.length === 0) {
        return {
          success: false,
          captchaId: response.data.captcha_id,
          points: [],
          message: "识别结果无效: 无坐标点",
        };
      }

      return {
        success: true,
        captchaId: response.data.captcha_id,
        points,
        message: response.message,
        elapsed: response.time,
      };
    } catch (error) {
      logger.error("识别失败:", error);
      return {
        success: false,
        captchaId: "",
        points: [],
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async reportError(): Promise<ReportErrorResult> {
    return { success: false, message: "Aegir does not support error reporting" };
  }

  async capture(containerId: string): Promise<ScreenshotResult | null> {
    try {
      const result = await captureScreenshot(containerId);
      logScreenshotPreview(result, 400, 300);
      return result;
    } catch (error) {
      logger.error("截图失败:", error);
      return null;
    }
  }
}
