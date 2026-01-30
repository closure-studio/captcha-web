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
import { TTShituClient, type TTShituOptions } from "./client";

const logger = createModuleLogger("TTShitu Slide");

/**
 * TTShitu 滑块验证码 bypass 配置
 */
export interface TTShituSlideConfig {
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
 */
const DEFAULT_CONFIG: Required<TTShituSlideConfig> = {
  xOffset: -10,
  slideSteps: 30,
  stepDelay: { min: 15, max: 25 },
  debug: true,
};

/**
 * TTShitu 滑块验证码 bypass 执行器
 * 专门处理 TTShitu 返回的滑块识别结果，并执行 bypass 操作
 */
export class TTShituSlide extends BaseCaptchaProvider {
  private config: Required<TTShituSlideConfig>;

  readonly name = ProviderNames.TTSHITU;
  private client: TTShituClient;

  constructor(captchaInfo: CaptchaInfo, options?: TTShituOptions) {
    super(captchaInfo);
    this.client = new TTShituClient(options);
    this.config = DEFAULT_CONFIG;
  }

  /**
   * 识别滑块验证码
   * @param request 识别请求参数
   * @returns 统一格式的识别结果
   */
  async solve(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
    try {
      logger.log("开始识别滑块验证码");
      const result = await this.client.predict(request.image);
      const x = parseInt(result.result, 10);

      if (isNaN(x)) {
        return {
          code: CaptchaSolveCode.FAILED,
          message: `识别结果无效: ${result.result}`,
          data: {
            captchaId: result.id,
            points: [],
          },
        };
      }

      logger.log("识别成功, X坐标:", x);
      return {
        code: CaptchaSolveCode.SUCCESS,
        message: "识别成功",
        data: {
          captchaId: result.id,
          points: [{ x, y: 0 }],
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
   * @param captchaId 验证码ID
   * @returns 报错结果
   */
  async reportError(captchaId: string): Promise<CaptchaReportErrorResult> {
    try {
      logger.log("报告识别错误, captchaId:", captchaId);
      const result = await this.client.reportError(captchaId);
      logger.log("报错成功:", result.result);
      return {
        success: true,
        message: result.result,
      };
    } catch (error) {
      logger.error("报错失败:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "报错失败",
      };
    }
  }

  /**
   * 执行 GeeTest 滑块验证码 bypass
   * TTShitu 返回的坐标是基于截图 canvas 的，需要转换为实际 DOM 坐标
   * @param context bypass 上下文，包含所需的 DOM 元素引用
   * @param solveResult TTShitu 的识别结果
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

      const targetX = solveResult.data.points[0].x;

      // 获取滑块按钮的位置（相对于容器内部计算）
      const btnRect = sliderBtn.getBoundingClientRect();
      const startX = btnRect.left - btnRect.width;
      const startY = btnRect.top + btnRect.height / 2;

      // 获取拼图块和验证码窗口的位置信息
      const sliceRect = sliceElement.getBoundingClientRect();
      const windowRect = captchaWindow.getBoundingClientRect();

      // 计算缩放比例：canvas 截图尺寸 vs 实际 DOM 元素尺寸
      const scaleFactor = windowRect.width / canvasWidth;

      // 将 TTShitu 返回的 targetX（基于 canvas 坐标）转换为实际 DOM 坐标
      const scaledTargetX = targetX * scaleFactor;

      // 计算拼图块当前在验证码图片中的相对x位置
      const sliceStartX = sliceRect.left - windowRect.left;

      // 计算需要滑动的距离（包含 TTShitu 特有的偏移量校正）
      const slideDistance = scaledTargetX - sliceStartX + this.config.xOffset;

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
          xOffset: this.config.xOffset,
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
    logger.log("识别返回的 targetX (canvas坐标):", info.targetX);
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

    // 创建 Touch 事件（用于支持移动端）
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

    // 模拟拖动过程
    // 1. 鼠标/触摸按下
    sliderBtn.dispatchEvent(createMouseEvent("mousedown", startX, startY));
    sliderBtn.dispatchEvent(createTouchEvent("touchstart", startX, startY));

    // 2. 逐步移动（模拟人类滑动）
    const steps = this.config.slideSteps;
    const deltaX = (endX - startX) / steps;
    const { min: delayMin, max: delayMax } = this.config.stepDelay;

    for (let i = 1; i <= steps; i++) {
      const currentX = startX + deltaX * i;
      // 添加随机偏移模拟人类行为
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
