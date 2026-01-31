import type { CaptchaInfo } from "../../../types/type";
import { createModuleLogger } from "../../logger";
import {
  captureScreenshot,
  logScreenshotPreview,
  type ScreenshotResult,
} from "../../screenshot";
/**
 * 验证码识别结果状态码
 */
export const CaptchaSolveCode = {
  /** 识别成功 */
  SUCCESS: "success",
  /** 识别失败 */
  FAILED: "failed",
} as const;

export type CaptchaSolveCodeValue =
  (typeof CaptchaSolveCode)[keyof typeof CaptchaSolveCode];

export const ProviderNames = {
  AEGIR: "Aegir",
  TTSHITU: "TTShitu",
  GEMINI: "Gemini",
} as const;

/**
 * 验证码类型
 */
export const CaptchaType = {
  /** 滑块验证码 */
  SLIDE: "slide",
  WORLD: "world",
  ICON: "icon",
} as const;

export type CaptchaTypeValue = (typeof CaptchaType)[keyof typeof CaptchaType];

/**
 * 坐标点
 */
export interface CaptchaPoint {
  x: number;
  y: number;
}

/**
 * 验证码识别结果数据
 */
export interface CaptchaSolveData {
  /** 验证码ID（用于报错） */
  captchaId: string;
  /** 坐标点数组（点选: 多个点; 滑块: 单个点，只需关注x坐标） */
  points: CaptchaPoint[];
  /** 额外的截图，用于上传到 R2（如预处理后的图片） */
  extraCaptures?: Record<string, string>;
}

/**
 * 验证码识别结果
 */
export interface CaptchaSolveResult {
  /** 结果消息 */
  message: string;
  /** 结果状态码 */
  code: CaptchaSolveCodeValue;
  /** 结果数据 */
  data: CaptchaSolveData;
}

/**
 * 验证码识别请求参数
 */
export interface CaptchaSolveRequest {
  /** Base64 编码的图片（不含 data:image/...;base64, 前缀） */
  image: string;
  /** 验证码类型 */
  type: CaptchaTypeValue;
  /** 背景图（部分滑块验证码需要） */
  backgroundImage?: string;
}

/**
 * 报错结果
 */
export interface CaptchaReportErrorResult {
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
}

/**
 * GeeTest 滑块验证码 bypass 上下文
 * 包含容器内所有需要的 DOM 元素引用
 */
export interface GeeTestSlideBypassContext {
  /** 容器元素 */
  container: HTMLElement;
  /** 滑块按钮元素 */
  sliderBtn: HTMLElement;
  /** 滑块轨道元素 */
  sliderTrack: HTMLElement;
  /** 拼图块元素 */
  sliceElement: HTMLElement;
  /** 验证码图片窗口元素 */
  captchaWindow: HTMLElement;
  /** 截图 canvas 的宽度（用于计算缩放比例） */
  canvasWidth: number;
}

/**
 * GeeTest 点选验证码 bypass 上下文
 */
export interface GeeTestClickBypassContext {
  /** 容器元素 */
  container: HTMLElement;
  /** 验证码图片窗口元素 */
  captchaWindow: HTMLElement;
  /** 截图 canvas 的宽度（用于计算缩放比例） */
  canvasWidth: number;
  /** 截图 canvas 的高度（用于计算缩放比例） */
  canvasHeight: number;
}

/**
 * Bypass 执行结果
 */
export interface BypassResult {
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
}

/**
 * 验证码提供者接口
 */
export interface ICaptchaProvider {
  /** 提供者名称 */
  readonly name: string;
  /** 验证码信息 */
  readonly captchaInfo: CaptchaInfo;

  /**
   * 识别验证码
   * @param request 识别请求参数
   * @returns 统一格式的识别结果
   */
  solve(request: CaptchaSolveRequest): Promise<CaptchaSolveResult>;

  /**
   * 报告识别错误
   * @param captchaId 验证码ID
   * @returns 报错结果
   */
  reportError(captchaId: string): Promise<CaptchaReportErrorResult>;

  /**
   * 执行 GeeTest 滑块验证码 bypass
   * 不同的 provider 可能返回不同的坐标偏差，所以 bypass 逻辑由 provider 实现
   * @param context bypass 上下文，包含所需的 DOM 元素引用
   * @param solveResult 识别结果
   * @returns bypass 执行结果
   */
  bypassGeeTestSlide?(
    context: GeeTestSlideBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult>;

  /**
   * 执行 GeeTest 点选验证码 bypass
   * @param context bypass 上下文
   * @param solveResult 识别结果
   * @returns bypass 执行结果
   */
  bypassGeeTestClick?(
    context: GeeTestClickBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult>;

  capture(containerId?: string): Promise<ScreenshotResult | null>;
}

/**
 * 验证码提供者抽象基类
 * 提供通用的 bypass 方法实现，子类只需实现 solve 和 reportError 方法
 */
export abstract class BaseCaptchaProvider implements ICaptchaProvider {
  /** 提供者名称 - 子类必须实现 */
  abstract readonly name: string;
  readonly captchaInfo: CaptchaInfo;
  protected readonly logger = createModuleLogger("BaseCaptchaProvider");

  constructor(captchaInfo: CaptchaInfo) {
    this.captchaInfo = captchaInfo;
  }

  /**
   * 识别验证码 - 子类必须实现
   */
  abstract solve(request: CaptchaSolveRequest): Promise<CaptchaSolveResult>;

  /**
   * 报告识别错误 - 子类必须实现
   */
  abstract reportError(captchaId: string): Promise<CaptchaReportErrorResult>;

  /**
   * 执行 GeeTest 点选验证码 bypass
   * 通用实现：将 canvas 坐标转换为实际 DOM 坐标并执行点击
   */
  async bypassGeeTestClick(
    context: GeeTestClickBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult> {
    try {
      const { captchaWindow, canvasWidth, canvasHeight } = context;

      if (solveResult.data.points.length === 0) {
        return {
          success: false,
          message: "No points in solve result",
        };
      }

      const windowRect = captchaWindow.getBoundingClientRect();

      // 计算缩放比例
      const scaleFactorX = windowRect.width / canvasWidth;
      const scaleFactorY = windowRect.height / canvasHeight;

      // 点击每个坐标点
      for (const point of solveResult.data.points) {
        // 将 canvas 坐标转换为实际 DOM 坐标
        const scaledX = point.x * scaleFactorX;
        const scaledY = point.y * scaleFactorY;

        // 计算在屏幕上的绝对坐标
        const clickX = windowRect.left + scaledX;
        const clickY = windowRect.top + scaledY;

        console.log("[BaseCaptchaProvider] 点击坐标:", {
          original: point,
          scaled: { x: scaledX, y: scaledY },
          screen: { x: clickX, y: clickY },
        });

        // 执行点击
        await this.performClick(captchaWindow, clickX, clickY);

        // 等待一段时间再点击下一个
        await this.sleep(200 + Math.random() * 100);
      }

      return {
        success: true,
        message: "Click bypass completed",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 执行点击操作
   * 子类可以调用此方法，也可以重写
   */
  protected async performClick(
    target: HTMLElement,
    x: number,
    y: number,
  ): Promise<void> {
    const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
    };

    target.dispatchEvent(new MouseEvent("mousedown", eventOptions));
    await this.sleep(50);
    target.dispatchEvent(new MouseEvent("mouseup", eventOptions));
    target.dispatchEvent(new MouseEvent("click", eventOptions));
  }

  /**
   * 延时工具方法
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 截图 GeeTest 容器，供子类调用
   * @param containerId 容器 DOM 的 id
   * @returns 截图结果或 null
   */
  async capture(containerId?: string): Promise<ScreenshotResult | null> {
    try {
      let captureContainerId = this.captchaInfo.containerId;
      if (containerId) {
        captureContainerId = containerId;
      }
      this.logger.log("截图目标容器ID:", captureContainerId);
      const result = await captureScreenshot(captureContainerId);
      this.logger.log("截图元素尺寸:", {
        width: result.canvas.width,
        height: result.canvas.height,
      });
      this.logger.log("验证码截图成功");
      logScreenshotPreview(result, 400, 300);
      return result;
    } catch (error) {
      this.logger.error("截图失败:", error);
      return null;
    }
  }
}
