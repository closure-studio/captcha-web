import {
  TTShituClient,
  TTShituTypeId,
  type TTShituOptions,
} from "../../utils/captcha/ttshitu/client";
import { createModuleLogger } from "../../utils/logger";
import {
  captureScreenshot,
  logScreenshotPreview,
  type ScreenshotResult,
} from "../../utils/screenshot";
import type {
  IRecognizer,
  RecognizeRequest,
  RecognizeResult,
  ReportErrorResult
} from "./types";

const logger = createModuleLogger("TTShitu Recognizer");

/**
 * TTShitu 识别器
 * 支持滑块（gap X）和文字点选（click 1-4）
 */
export class TTShituRecognizer implements IRecognizer {
  readonly name = "TTShitu";
  private client: TTShituClient;

  constructor(options?: TTShituOptions) {
    this.client = new TTShituClient(options);
  }

  async recognize(request: RecognizeRequest): Promise<RecognizeResult> {
    try {
      if (request.type === "slide") {
        return await this.recognizeSlide(request.image);
      }
      return await this.recognizeClick(request.image);
    } catch (error) {
      logger.error("识别失败:", error);
      return {
        success: false,
        captchaId: "",
        points: [],
        message: error instanceof Error ? error.message : "识别失败",
      };
    }
  }

  private async recognizeSlide(image: string): Promise<RecognizeResult> {
    const result = await this.client.predict(image);
    const x = parseInt(result.result, 10);

    if (isNaN(x)) {
      return {
        success: false,
        captchaId: result.id,
        points: [],
        message: `识别结果无效: ${result.result}`,
      };
    }

    return {
      success: true,
      captchaId: result.id,
      points: [{ x, y: 0 }],
      message: "识别成功",
    };
  }

  private async recognizeClick(image: string): Promise<RecognizeResult> {
    const result = await this.client.predict(image, TTShituTypeId.CLICK_1_4);
    const points = this.parseClickPoints(result.result);

    if (points.length === 0) {
      return {
        success: false,
        captchaId: result.id,
        points: [],
        message: `识别结果无效: ${result.result}`,
      };
    }

    return {
      success: true,
      captchaId: result.id,
      points,
      message: "识别成功",
    };
  }

  private parseClickPoints(result: string): { x: number; y: number }[] {
    if (!result || typeof result !== "string") return [];

    return result
      .split("|")
      .map((pointStr) => {
        const [xStr, yStr] = pointStr.split(",");
        const x = parseInt(xStr?.trim(), 10);
        const y = parseInt(yStr?.trim(), 10);
        return !isNaN(x) && !isNaN(y) ? { x, y } : null;
      })
      .filter((p): p is { x: number; y: number } => p !== null);
  }

  async reportError(captchaId: string): Promise<ReportErrorResult> {
    try {
      const result = await this.client.reportError(captchaId);
      return { success: true, message: result.result };
    } catch (error) {
      logger.error("报错失败:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "报错失败",
      };
    }
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
