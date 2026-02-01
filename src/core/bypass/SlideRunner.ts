import { createModuleLogger } from "../../utils/logger";
import type {
  BypassResult,
  GeeTestSlideBypassContext,
  SlideConfig,
} from "./types";

const logger = createModuleLogger("SlideRunner");

/**
 * 默认滑动配置
 */
const DEFAULT_CONFIG: SlideConfig = {
  xOffset: -10,
  slideSteps: 30,
  stepDelay: { min: 15, max: 25 },
  debug: true,
};

/**
 * 通用滑动执行器
 * 消除 TTShituSlide 和 GeminiSlide 中的重复滑动代码
 */
export class SlideRunner {
  private config: SlideConfig;

  constructor(config?: Partial<SlideConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行 GeeTest 滑块 bypass
   * @param context bypass 上下文
   * @param targetX 识别返回的目标 X 坐标（基于 canvas）
   */
  async execute(
    context: GeeTestSlideBypassContext,
    targetX: number,
  ): Promise<BypassResult> {
    try {
      const { sliderBtn, sliceElement, captchaWindow, canvasWidth } = context;

      // 获取滑块按钮的位置
      const btnRect = sliderBtn.getBoundingClientRect();
      const startX = btnRect.left - btnRect.width;
      const startY = btnRect.top + btnRect.height / 2;

      // 获取拼图块和验证码窗口的位置信息
      const sliceRect = sliceElement.getBoundingClientRect();
      const windowRect = captchaWindow.getBoundingClientRect();

      // 计算缩放比例：canvas 截图尺寸 vs 实际 DOM 元素尺寸
      const scaleFactor = windowRect.width / canvasWidth;

      // 将 canvas 坐标转换为实际 DOM 坐标
      const scaledTargetX = targetX * scaleFactor;

      // 计算拼图块当前在验证码图片中的相对x位置
      const sliceStartX = sliceRect.left - windowRect.left;

      // 计算需要滑动的距离（包含偏移量校正）
      const slideDistance = scaledTargetX - sliceStartX + this.config.xOffset;

      // 最终的鼠标目标位置
      const endX = startX + slideDistance;
      const endY = startY;

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

      return { success: true, message: "Slide bypass completed" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
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

    // 2. 逐步移动（模拟人类滑动）
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
      sliderBtn.dispatchEvent(
        createTouchEvent("touchmove", currentX, randomY),
      );
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
}
