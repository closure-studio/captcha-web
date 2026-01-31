import type { CaptchaInfo } from "../../../types/type";
import { createModuleLogger } from "../../logger";
import {
  BaseCaptchaProvider,
  CaptchaSolveCode,
  ProviderNames,
  type BypassResult,
  type CaptchaReportErrorResult,
  type CaptchaSolveRequest,
  type CaptchaSolveResult,
  type GeeTestSlideBypassContext,
} from "../type/provider";
import { GeminiClient, type GeminiClientOptions } from "./client";

const logger = createModuleLogger("Gemini Slide");

/**
 * 图片裁剪配置 - 用于预处理
 * 只裁剪高度，不处理宽度
 */
export interface ImageCropConfig {
  /** 上部分裁剪的像素数 */
  topCrop: number;
  /** 下部分裁剪的像素数 */
  bottomCrop: number;
}

/**
 * Gemini 滑块验证码 bypass 配置
 */
export interface GeminiSlideConfig {
  /** 图片裁剪配置 */
  cropConfig: ImageCropConfig;
  /** X轴偏移量校正值，用于修正识别结果的偏差 */
  xOffset?: number;
  /** 滑动步数，影响滑动速度和平滑度 */
  slideSteps?: number;
  /** 每步滑动的延迟时间范围（毫秒） */
  stepDelay?: {
    min: number;
    max: number;
  };
  /** 是否启用调试日志 */
  debug?: boolean;
}

/**
 * 默认配置
 * topCrop 和 bottomCrop 是 hardcode 的值，需要根据实际情况调整
 */
const DEFAULT_CONFIG: Required<GeminiSlideConfig> = {
  cropConfig: {
    topCrop: 70, // 上部分裁剪像素数 - 可调整
    bottomCrop: 110, // 下部分裁剪像素数 - 可调整
  },
  xOffset: 0,
  slideSteps: 30,
  stepDelay: { min: 15, max: 25 },
  debug: true,
};

/**
 * Gemini 滑块验证码 bypass 执行器
 * 专门处理 Gemini 返回的滑块识别结果，并执行 bypass 操作
 */
export class GeminiSlide extends BaseCaptchaProvider {
  private config: Required<GeminiSlideConfig>;

  readonly name = ProviderNames.GEMINI;
  private client: GeminiClient;

  constructor(captchaInfo: CaptchaInfo, options?: GeminiClientOptions) {
    super(captchaInfo);
    this.client = new GeminiClient(options);
    this.config = DEFAULT_CONFIG;
  }

  /**
   * 设置裁剪配置
   */
  setCropConfig(cropConfig: Partial<ImageCropConfig>): void {
    this.config.cropConfig = {
      ...this.config.cropConfig,
      ...cropConfig,
    };
    logger.log("裁剪配置已更新:", this.config.cropConfig);
  }

  /**
   * 将 base64 图片绘制到 canvas 并裁剪高度
   * @param base64Image base64 编码的图片
   * @returns 裁剪后的 base64 图片
   */
  private async cropImageHeight(base64Image: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const { topCrop, bottomCrop } = this.config.cropConfig;

        // 计算裁剪后的高度
        const originalWidth = img.width;
        const originalHeight = img.height;
        const croppedHeight = originalHeight - topCrop - bottomCrop;

        if (croppedHeight <= 0) {
          reject(new Error("裁剪配置错误：裁剪后高度为负数或零"));
          return;
        }

        // 创建 canvas 进行裁剪
        const canvas = document.createElement("canvas");
        canvas.width = originalWidth;
        canvas.height = croppedHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法获取 canvas 2d context"));
          return;
        }

        // 从原图的 topCrop 位置开始绘制
        ctx.drawImage(
          img,
          0,
          topCrop, // 源图像起始位置
          originalWidth,
          croppedHeight, // 源图像截取区域
          0,
          0, // 目标位置
          originalWidth,
          croppedHeight, // 目标尺寸
        );

        // 转换为 base64
        const croppedBase64 = canvas.toDataURL("image/png");
        resolve(croppedBase64);
      };

      img.onerror = () => {
        reject(new Error("图片加载失败"));
      };

      // 确保 base64 有正确的前缀
      if (base64Image.startsWith("data:")) {
        img.src = base64Image;
      } else {
        img.src = `data:image/png;base64,${base64Image}`;
      }
    });
  }

  /**
   * 在控制台输出图片预览（用于调试）
   */
  private logImagePreview(
    label: string,
    base64Image: string,
    width: number,
    height: number,
  ): void {
    // 确保有 data URL 前缀
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

  /**
   * 获取图片尺寸
   */
  private async getImageDimensions(
    base64Image: string,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        reject(new Error("无法获取图片尺寸"));
      };
      if (base64Image.startsWith("data:")) {
        img.src = base64Image;
      } else {
        img.src = `data:image/png;base64,${base64Image}`;
      }
    });
  }

  /**
   * 识别滑块验证码
   * @param request 识别请求参数
   * @returns 统一格式的识别结果
   */
  async solve(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
    try {
      logger.log("开始识别滑块验证码");

      const originalImage = request.image;

      // 调试输出：原始图片
      if (this.config.debug) {
        const originalDimensions = await this.getImageDimensions(originalImage);
        console.log("========== 图片预处理调试 ==========");
        console.log(
          `裁剪配置: topCrop=${this.config.cropConfig.topCrop}, bottomCrop=${this.config.cropConfig.bottomCrop}`,
        );
        this.logImagePreview(
          "原始图片",
          originalImage,
          originalDimensions.width,
          originalDimensions.height,
        );
      }

      // 预处理：裁剪图片高度
      logger.log("开始预处理图片（裁剪高度）...");
      const croppedImage = await this.cropImageHeight(originalImage);

      // 调试输出：裁剪后的图片
      if (this.config.debug) {
        const croppedDimensions = await this.getImageDimensions(croppedImage);
        this.logImagePreview(
          "裁剪后图片",
          croppedImage,
          croppedDimensions.width,
          croppedDimensions.height,
        );
        console.log("=====================================");
      }

      // 调用 Gemini API 识别
      const result = await this.client.solveSlider(croppedImage);

      if (!result.success || !result.data || result.data.length === 0) {
        return {
          code: CaptchaSolveCode.FAILED,
          message: "识别结果无效",
          data: {
            captchaId: "",
            points: [],
          },
        };
      }

      const x = result.data[0].x;

      logger.log("识别成功, X坐标:", x);

      return {
        code: CaptchaSolveCode.SUCCESS,
        message: "识别成功",
        data: {
          captchaId: "",
          points: [{ x, y: 0 }],
          extraCaptures: {
            cropped: croppedImage,
          },
        },
      };
    } catch (error) {
      logger.error("识别失败:", error);
      return {
        code: CaptchaSolveCode.FAILED,
        message: error instanceof Error ? error.message : "识别失败",
        data: {
          captchaId: "",
          points: [],
        },
      };
    }
  }

  /**
   * 报告识别错误
   * Gemini 目前不支持报错接口
   */
  async reportError(): Promise<CaptchaReportErrorResult> {
    logger.log("Gemini 不支持报错接口");
    return {
      success: false,
      message: "Gemini 不支持报错接口",
    };
  }

  /**
   * 执行 GeeTest 滑块验证码 bypass
   * @param context bypass 上下文，包含所需的 DOM 元素引用
   * @param solveResult 识别结果
   * @returns bypass 执行结果
   */
  async bypassGeeTestSlide(
    context: GeeTestSlideBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult> {
    try {
      const { sliderBtn, sliceElement, captchaWindow, canvasWidth } = context;

      if (solveResult.data.points.length === 0) {
        return {
          success: false,
          message: "No points in solve result",
        };
      }

      // 由于只裁剪了高度，x 坐标不需要调整
      const targetX = solveResult.data.points[0].x;

      // 获取滑块按钮的位置
      const btnRect = sliderBtn.getBoundingClientRect();
      const startX = btnRect.left - btnRect.width;
      const startY = btnRect.top + btnRect.height / 2;

      // 获取拼图块和验证码窗口的位置信息
      const sliceRect = sliceElement.getBoundingClientRect();
      const windowRect = captchaWindow.getBoundingClientRect();

      // 计算缩放比例：canvas 截图尺寸 vs 实际 DOM 元素尺寸
      const scaleFactor = windowRect.width / canvasWidth;

      // 将识别返回的 targetX 转换为实际 DOM 坐标
      const scaledTargetX = targetX * scaleFactor;

      // 计算拼图块当前在验证码图片中的相对x位置
      const sliceStartX = sliceRect.left - windowRect.left;

      // 计算需要滑动的距离
      const slideDistance =
        scaledTargetX - sliceStartX + (this.config.xOffset || 0);

      // 最终的鼠标目标位置
      const endX = startX + slideDistance;
      const endY = startY;

      // 调试信息
      if (this.config.debug) {
        this.logDebugInfo({
          targetX,
          canvasWidth,
          windowWidth: windowRect.width,
          scaleFactor,
          scaledTargetX,
          xOffset: this.config.xOffset || 0,
          sliceRect,
          sliceStartX,
          slideDistance,
          startX,
          endX,
        });
      }

      // 执行滑动
      await this.performSlide(sliderBtn, startX, startY, endX, endY);

      return {
        success: true,
        message: "Slide bypass completed",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 输出调试信息
   */
  private logDebugInfo(info: {
    targetX: number;
    canvasWidth: number;
    windowWidth: number;
    scaleFactor: number;
    scaledTargetX: number;
    xOffset: number;
    sliceRect: DOMRect;
    sliceStartX: number;
    slideDistance: number;
    startX: number;
    endX: number;
  }): void {
    logger.log("========== 滑动调试信息 ==========");
    logger.log("识别返回的 targetX:", info.targetX);
    logger.log("Canvas 宽度:", info.canvasWidth);
    logger.log("验证码窗口 DOM 宽度:", info.windowWidth);
    logger.log("缩放比例 (DOM/Canvas):", info.scaleFactor);
    logger.log("缩放后的 targetX (DOM坐标):", info.scaledTargetX);
    logger.log("X 偏移量校正:", info.xOffset);
    logger.log("拼图块当前位置:", {
      left: info.sliceRect.left,
      relativeLeft: info.sliceStartX,
      width: info.sliceRect.width,
    });
    logger.log("滑动计算:", {
      sliceStartX: info.sliceStartX,
      scaledTargetX: info.scaledTargetX,
      slideDistance: info.slideDistance,
      startX: info.startX,
      endX: info.endX,
    });
    logger.log("=====================================");
  }

  /**
   * 执行滑动操作
   */
  private async performSlide(
    sliderBtn: HTMLElement,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): Promise<void> {
    // 创建鼠标事件
    const createMouseEvent = (type: string, x: number, y: number) => {
      return new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === "mouseup" ? 0 : 1,
      });
    };

    // 创建 Touch 事件
    const createTouchEvent = (type: string, x: number, y: number) => {
      const touch = new Touch({
        identifier: Date.now(),
        target: sliderBtn,
        clientX: x,
        clientY: y,
        pageX: x + window.scrollX,
        pageY: y + window.scrollY,
        screenX: x,
        screenY: y,
      });
      return new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === "touchend" ? [] : [touch],
        targetTouches: type === "touchend" ? [] : [touch],
        changedTouches: [touch],
      });
    };

    // 1. 鼠标/触摸按下
    sliderBtn.dispatchEvent(createMouseEvent("mousedown", startX, startY));
    sliderBtn.dispatchEvent(createTouchEvent("touchstart", startX, startY));

    // 2. 逐步移动
    const steps = this.config.slideSteps;
    const deltaX = (endX - startX) / steps;
    const { min: delayMin, max: delayMax } = this.config.stepDelay;

    for (let i = 1; i <= steps; i++) {
      const currentX = startX + deltaX * i;
      const randomY = startY + (Math.random() - 0.5) * 2;

      await new Promise((resolve) =>
        setTimeout(resolve, delayMin + Math.random() * (delayMax - delayMin)),
      );

      sliderBtn.dispatchEvent(createMouseEvent("mousemove", currentX, randomY));
      sliderBtn.dispatchEvent(createTouchEvent("touchmove", currentX, randomY));
      document.dispatchEvent(createMouseEvent("mousemove", currentX, randomY));
    }

    // 3. 最后一次移动到准确位置
    await new Promise((resolve) => setTimeout(resolve, 50));
    sliderBtn.dispatchEvent(createMouseEvent("mousemove", endX, endY));
    sliderBtn.dispatchEvent(createTouchEvent("touchmove", endX, endY));
    document.dispatchEvent(createMouseEvent("mousemove", endX, endY));

    // 4. 鼠标/触摸松开
    await new Promise((resolve) => setTimeout(resolve, 100));
    sliderBtn.dispatchEvent(createMouseEvent("mouseup", endX, endY));
    sliderBtn.dispatchEvent(createTouchEvent("touchend", endX, endY));
    document.dispatchEvent(createMouseEvent("mouseup", endX, endY));
  }
}
