import { createModuleLogger } from "../../utils/logger";
import { recordElapsed } from "../../hooks/useSystemInfoManager";
import { DEFAULT_SLIDE_CROP, DEFAULT_CLICK_CROP } from "../../consts/consts";
import type { ImageCropConfig, RecognitionClientOptions } from "../../types/api";
import {
  captureScreenshot,
  logScreenshotPreview,
  type ScreenshotResult,
} from "../../utils/screenshot";
import {
  CloudflareClient,
} from "../../utils/captcha/cloudflare/client";
import type {
  CaptchaCollector,
  IRecognizer,
  RecognizeRequest,
  RecognizeResult,
  ReportErrorResult,
} from "./types";

const logger = createModuleLogger("Cloudflare Recognizer");

/**
 * Cloudflare 识别器
 * 支持滑块验证码和点选验证码，带图片预处理（裁剪高度）
 */
export class CloudflareRecognizer implements IRecognizer {
  readonly name = "Cloudflare";
  private client: CloudflareClient;
  private slideCropConfig: ImageCropConfig;
  private clickCropConfig: ImageCropConfig;

  constructor(
    options?: RecognitionClientOptions,
    slideCropConfig?: Partial<ImageCropConfig>,
    clickCropConfig?: Partial<ImageCropConfig>,
  ) {
    this.client = new CloudflareClient(options);
    this.slideCropConfig = { ...DEFAULT_SLIDE_CROP, ...slideCropConfig };
    this.clickCropConfig = { ...DEFAULT_CLICK_CROP, ...clickCropConfig };
  }

  setSlideCropConfig(cropConfig: Partial<ImageCropConfig>): void {
    this.slideCropConfig = { ...this.slideCropConfig, ...cropConfig };
  }

  setClickCropConfig(cropConfig: Partial<ImageCropConfig>): void {
    this.clickCropConfig = { ...this.clickCropConfig, ...cropConfig };
  }

  async recognize(
    request: RecognizeRequest,
    collector?: CaptchaCollector,
  ): Promise<RecognizeResult> {
    try {
      let result: RecognizeResult;
      if (request.type === "slide") {
        result = await this.recognizeSlide(request.image, collector);
      } else {
        result = await this.recognizeClick(request.image, collector);
      }
      if (result.elapsed != null) {
        recordElapsed(this.name, result.elapsed);
      }
      return result;
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

  private async recognizeSlide(
    image: string,
    collector?: CaptchaCollector,
  ): Promise<RecognizeResult> {
    const originalImage = image;

    // 调试输出：原始图片
    const originalDimensions = await this.getImageDimensions(originalImage);
    this.logImagePreview(
      "原始图片",
      originalImage,
      originalDimensions.width,
      originalDimensions.height,
    );

    // 预处理：裁剪图片高度
    const croppedImage = await this.cropImage(originalImage, this.slideCropConfig);

    collector?.addCapture("cropped", croppedImage);

    // 调试输出：裁剪后的图片
    const croppedDimensions = await this.getImageDimensions(croppedImage);
    this.logImagePreview(
      "裁剪后图片",
      croppedImage,
      croppedDimensions.width,
      croppedDimensions.height,
    );

    // 调用 Cloudflare API 识别
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

    return {
      success: true,
      captchaId: "",
      points: [{ x, y: 0 }],
      message: "识别成功",
      elapsed: result.elapsed,
    };
  }

  private async recognizeClick(
    image: string,
    collector?: CaptchaCollector,
  ): Promise<RecognizeResult> {
    const originalImage = image;

    // 调试输出：原始图片
    const originalDimensions = await this.getImageDimensions(originalImage);
    this.logImagePreview(
      "原始图片",
      originalImage,
      originalDimensions.width,
      originalDimensions.height,
    );

    // 预处理：裁剪图片高度
    const croppedImage = await this.cropImage(originalImage, this.clickCropConfig);

    collector?.addCapture("cropped", croppedImage);

    // 调试输出：裁剪后的图片
    const croppedDimensions = await this.getImageDimensions(croppedImage);
    this.logImagePreview(
      "裁剪后图片",
      croppedImage,
      croppedDimensions.width,
      croppedDimensions.height,
    );

    // 调用 Cloudflare API 识别
    const result = await this.client.solveIcon(croppedImage);

    if (!result.success || !result.data || result.data.length === 0) {
      return {
        success: false,
        captchaId: "",
        points: [],
        message: "识别结果无效",
      };
    }

    // 补偿裁剪偏移：识别结果基于裁剪后的图片，需要加上 topCrop 还原到原始坐标
    const { topCrop } = this.clickCropConfig;
    const compensatedPoints = result.data.map((point) => ({
      x: point.x,
      y: point.y + topCrop,
    }));

    return {
      success: true,
      captchaId: "",
      points: compensatedPoints,
      message: "识别成功",
      elapsed: result.elapsed,
    };
  }

  async reportError(): Promise<ReportErrorResult> {
    return { success: false, message: "Cloudflare 不支持报错接口" };
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

  /**
   * 裁剪图片高度
   */
  private async cropImage(
    base64Image: string,
    config: ImageCropConfig,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
        img.src = "";
      };

      img.onload = () => {
        const { topCrop, bottomCrop } = config;
        const originalWidth = img.width;
        const originalHeight = img.height;
        const croppedHeight = originalHeight - topCrop - bottomCrop;

        if (croppedHeight <= 0) {
          cleanup();
          reject(new Error("裁剪配置错误：裁剪后高度为负数或零"));
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = originalWidth;
        canvas.height = croppedHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
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

        const result = canvas.toDataURL("image/png");
        // 清理 canvas
        canvas.width = 0;
        canvas.height = 0;
        cleanup();
        resolve(result);
      };

      img.onerror = () => {
        cleanup();
        reject(new Error("图片加载失败"));
      };

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
    // 创建缩略图以减少日志中的内存占用
    const img = new Image();

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };

    img.onload = () => {
      const maxSize = 200;
      const scale = Math.min(maxSize / width, maxSize / height, 1);
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = Math.floor(width * scale);
      thumbCanvas.height = Math.floor(height * scale);
      const ctx = thumbCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
        const thumbUrl = thumbCanvas.toDataURL("image/jpeg", 0.6);
        const thumbWidth = thumbCanvas.width;
        const thumbHeight = thumbCanvas.height;
        // 清理
        thumbCanvas.width = 0;
        thumbCanvas.height = 0;
        cleanup();

        logger.log(
          `%c${label}`,
          "font-weight: bold; font-size: 14px; color: #00f;",
        );
        logger.log(
          `%c `,
          `background: url(${thumbUrl}) no-repeat; background-size: contain; padding: ${thumbHeight / 2 || height / 4}px ${thumbWidth / 2 || width / 4}px;`,
        );
        logger.log(`尺寸: ${width} x ${height}`);
      } else {
        cleanup();
      }
    };
    img.onerror = () => {
      cleanup();
      logger.log(`${label}: 尺寸 ${width} x ${height} (预览加载失败)`);
    };

    if (base64Image.startsWith("data:")) {
      img.src = base64Image;
    } else {
      img.src = `data:image/png;base64,${base64Image}`;
    }
  }

  private async getImageDimensions(
    base64Image: string,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
        img.src = "";
      };

      img.onload = () => {
        const result = { width: img.width, height: img.height };
        cleanup();
        resolve(result);
      };
      img.onerror = () => {
        cleanup();
        reject(new Error("无法获取图片尺寸"));
      };
      if (base64Image.startsWith("data:")) {
        img.src = base64Image;
      } else {
        img.src = `data:image/png;base64,${base64Image}`;
      }
    });
  }
}
