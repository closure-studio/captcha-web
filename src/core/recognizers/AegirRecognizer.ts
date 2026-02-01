import { createModuleLogger } from "../../utils/logger";
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
      logger.log("开始识别验证码");
      const response = await this.client.selectCaptcha(request.image);
      const points = this.client.parsePoints(response.data.points);

      if (points.length === 0) {
        return {
          success: false,
          captchaId: response.data.captcha_id,
          points: [],
          message: "识别结果无效: 无坐标点",
        };
      }

      logger.log("识别成功, 坐标点:", points);
      return {
        success: true,
        captchaId: response.data.captcha_id,
        points,
        message: response.message,
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
      logger.log("截图目标容器ID:", containerId);
      const result = await captureScreenshot(containerId);
      logger.log("截图元素尺寸:", {
        width: result.canvas.width,
        height: result.canvas.height,
      });
      logScreenshotPreview(result, 400, 300);
      return result;
    } catch (error) {
      logger.error("截图失败:", error);
      return null;
    }
  }
}
