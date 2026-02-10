import { createModuleLogger } from "../../utils/logger";
import type {
  BypassResult,
  ClickConfig,
  GeeTestClickBypassContext,
  Point,
} from "./types";

const logger = createModuleLogger("ClickRunner");

/** 确认按钮选择器列表 */
const COMMIT_BUTTON_SELECTORS = [
  'div[class*="geetest_commit"]',
  'a[class*="geetest_commit"]',
  'button[class*="geetest_commit"]',
  'div[class*="geetest_submit"]',
  'a[class*="geetest_submit"]',
];

/**
 * 默认点击配置
 */
const DEFAULT_CONFIG: ClickConfig = {
  delay: { min: 400, max: 600 },
  debug: true,
};

/**
 * 通用点击执行器
 * 处理 GeeTest 点选验证码的 bypass 操作
 */
export class ClickRunner {
  private config: ClickConfig;

  constructor(config?: Partial<ClickConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行 GeeTest 点选 bypass
   * @param context bypass 上下文
   * @param points 需要点击的坐标点数组
   * @param options 额外选项
   */
  async execute(
    context: GeeTestClickBypassContext,
    points: Point[],
    options?: { clickCommit?: boolean },
  ): Promise<BypassResult> {
    try {
      const { container, canvasWidth, canvasHeight } = context;
      // 使用截图源元素做缩放基准，保证坐标映射一致
      const scalingEl = context.screenshotElement || container;
      const clickCommit = options?.clickCommit ?? true;

      if (points.length === 0) {
        return { success: false, message: "No points in solve result" };
      }

      const scalingRect = scalingEl.getBoundingClientRect();
      const scaleFactorX = scalingRect.width / canvasWidth;
      const scaleFactorY = scalingRect.height / canvasHeight;


      // 点击每个坐标点
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const currentRect = scalingEl.getBoundingClientRect();

        const scaledX = point.x * scaleFactorX;
        const scaledY = point.y * scaleFactorY;
        const clickX = currentRect.left + scaledX;
        const clickY = currentRect.top + scaledY;

        const elementAtPoint = this.getElementAtPoint(clickX, clickY);

        await this.dispatchClickEvents(elementAtPoint, clickX, clickY);

        // 等待 GeeTest 处理点击
        const { min, max } = this.config.delay;
        const delay =
          i === 0 ? max + 200 : min + Math.random() * (max - min);
        await this.sleep(delay);
      }

      // 点击确认按钮
      if (clickCommit) {
        await this.sleep(300);
        await this.clickCommitButton(container);
      }

      return { success: true, message: "Click bypass completed" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 简单点选 bypass（使用 captchaWindow 作为缩放基准）
   * 适用于 BaseCaptchaProvider 中的通用点选逻辑
   */
  async executeSimple(
    context: GeeTestClickBypassContext,
    points: Point[],
  ): Promise<BypassResult> {
    try {
      const { captchaWindow, canvasWidth, canvasHeight } = context;

      if (points.length === 0) {
        return { success: false, message: "No points in solve result" };
      }

      const windowRect = captchaWindow.getBoundingClientRect();
      const scaleFactorX = windowRect.width / canvasWidth;
      const scaleFactorY = windowRect.height / canvasHeight;

      for (const point of points) {
        const scaledX = point.x * scaleFactorX;
        const scaledY = point.y * scaleFactorY;
        const clickX = windowRect.left + scaledX;
        const clickY = windowRect.top + scaledY;

        await this.performClick(captchaWindow, clickX, clickY);
        await this.sleep(200 + Math.random() * 100);
      }

      return { success: true, message: "Click bypass completed" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 获取点击位置的元素，穿透 GeeTest 点击标记
   */
  private getElementAtPoint(x: number, y: number): HTMLElement | null {
    let element = document.elementFromPoint(x, y) as HTMLElement | null;

    if (
      element?.className?.includes?.("geetest_click") ||
      element?.className?.includes?.("geetest_tip")
    ) {
      element.style.pointerEvents = "none";
      element = document.elementFromPoint(x, y) as HTMLElement | null;
    }

    return element;
  }

  /**
   * 触发点击事件（完整事件序列）
   */
  private async dispatchClickEvents(
    target: HTMLElement | null,
    x: number,
    y: number,
  ): Promise<void> {
    if (!target) return;

    const eventInit: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    };

    target.dispatchEvent(new PointerEvent("pointerdown", eventInit));
    await this.sleep(20);
    target.dispatchEvent(new MouseEvent("mousedown", eventInit));
    await this.sleep(30);
    target.dispatchEvent(
      new PointerEvent("pointerup", { ...eventInit, buttons: 0 }),
    );
    target.dispatchEvent(
      new MouseEvent("mouseup", { ...eventInit, buttons: 0 }),
    );
    target.dispatchEvent(
      new MouseEvent("click", { ...eventInit, buttons: 0 }),
    );
  }

  /**
   * 简单点击
   */
  private async performClick(
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
   * 在容器内查找并点击 GeeTest 确认按钮
   */
  private async clickCommitButton(container: HTMLElement): Promise<void> {
    let button: HTMLElement | null = null;

    for (const selector of COMMIT_BUTTON_SELECTORS) {
      button = container.querySelector<HTMLElement>(selector);
      if (button) {
        break;
      }
    }

    if (!button) {
      logger.warn("未找到确认按钮");
      return;
    }

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    logger.log("点击确认按钮");
    await this.dispatchClickEvents(button, x, y);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
