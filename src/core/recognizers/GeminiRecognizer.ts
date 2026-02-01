import { createModuleLogger } from "../../utils/logger";
import {
  captureScreenshot,
  logScreenshotPreview,
  type ScreenshotResult,
} from "../../utils/screenshot";
import {
  GeminiClient,
  type GeminiClientOptions,
} from "../../utils/captcha/gemini/client";
import type {
  CaptchaCollector,
  IRecognizer,
  RecognizeRequest,
  RecognizeResult,
  ReportErrorResult,
} from "./types";

const logger = createModuleLogger("Gemini Recognizer");

/**
 * 图片裁剪配置
 */
export interface ImageCropConfig {
  topCrop: number;
  bottomCrop: number;
}

const DEFAULT_CROP_CONFIG: ImageCropConfig = {
  topCrop: 70,
  bottomCrop: 110,
};

/**
 * Gemini 识别器
 * 支持滑块验证码，带图片预处理（裁剪高度）
 */
export class GeminiRecognizer implements IRecognizer {
  readonly name = "Gemini";
  private client: GeminiClient;
  private cropConfig: ImageCropConfig;

  constructor(
    options?: GeminiClientOptions,
    cropConfig?: Partial<ImageCropConfig>,
  ) {
    this.client = new GeminiClient(options);
    this.cropConfig = { ...DEFAULT_CROP_CONFIG, ...cropConfig };
  }

  setCropConfig(cropConfig: Partial<ImageCropConfig>): void {
    this.cropConfig = { ...this.cropConfig, ...cropConfig };
    logger.log("裁剪配置已更新:", this.cropConfig);
  }

  async recognize(
    request: RecognizeRequest,
    collector?: CaptchaCollector,
  ): Promise<RecognizeResult> {
    try {
      logger.log("开始识别滑块验证码");
      const originalImage = request.image;

      // 调试输出：原始图片
      const originalDimensions = await this.getImageDimensions(originalImage);
      logger.log(
        `裁剪配置: topCrop=${this.cropConfig.topCrop}, bottomCrop=${this.cropConfig.bottomCrop}`,
      );
      this.logImagePreview(
        "原始图片",
        originalImage,
        originalDimensions.width,
        originalDimensions.height,
      );

      // 预处理：裁剪图片高度
      logger.log("开始预处理图片（裁剪高度）...");
      const croppedImage = await this.cropImageHeight(originalImage);

      collector?.addCapture("cropped", croppedImage);

      // 调试输出：裁剪后的图片
      const croppedDimensions = await this.getImageDimensions(croppedImage);
      this.logImagePreview(
        "裁剪后图片",
        croppedImage,
        croppedDimensions.width,
        croppedDimensions.height,
      );

      // 调用 Gemini API 识别
      const result = await this.client.solveSlider(croppedImage);

      if (!result.success || !result.data || result.data.length === 0) {
        return {
          success: false,
          captchaId: "",
          points: [],
          message: "识别结果无效",
        };
      }

      const x = result.data[0].x;
      logger.log("识别成功, X坐标:", x);

      return {
        success: true,
        captchaId: "",
        points: [{ x, y: 0 }],
        message: "识别成功",
      };
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

  async reportError(): Promise<ReportErrorResult> {
    logger.log("Gemini 不支持报错接口");
    return { success: false, message: "Gemini 不支持报错接口" };
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

  private async cropImageHeight(base64Image: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const { topCrop, bottomCrop } = this.cropConfig;
        const originalWidth = img.width;
        const originalHeight = img.height;
        const croppedHeight = originalHeight - topCrop - bottomCrop;

        if (croppedHeight <= 0) {
          reject(new Error("裁剪配置错误：裁剪后高度为负数或零"));
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = originalWidth;
        canvas.height = croppedHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法获取 canvas 2d context"));
          return;
        }

        ctx.drawImage(
          img,
          0,
          topCrop,
          originalWidth,
          croppedHeight,
          0,
          0,
          originalWidth,
          croppedHeight,
        );

        resolve(canvas.toDataURL("image/png"));
      };

      img.onerror = () => reject(new Error("图片加载失败"));

      if (base64Image.startsWith("data:")) {
        img.src = base64Image;
      } else {
        img.src = `data:image/png;base64,${base64Image}`;
      }
    });
  }

  private logImagePreview(
    label: string,
    base64Image: string,
    width: number,
    height: number,
  ): void {
    const dataUrl = base64Image.startsWith("data:")
      ? base64Image
      : `data:image/png;base64,${base64Image}`;

    console.log(
      `%c${label}`,
      "font-weight: bold; font-size: 14px; color: #00f;",
    );
    console.log(
      `%c `,
      `background: url(${dataUrl}) no-repeat; background-size: contain; padding: ${height / 2}px ${width / 2}px;`,
    );
    console.log(`尺寸: ${width} x ${height}`);
  }

  private async getImageDimensions(
    base64Image: string,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error("无法获取图片尺寸"));
      if (base64Image.startsWith("data:")) {
        img.src = base64Image;
      } else {
        img.src = `data:image/png;base64,${base64Image}`;
      }
    });
  }
}
