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
  type GeeTestClickBypassContext,
} from "../type/provider";
import { TTShituClient, TTShituTypeId, type TTShituOptions } from "./client";

const logger = createModuleLogger("TTShitu World");

/** 点击间隔配置（毫秒） */
const CLICK_DELAY = { min: 400, max: 600 };

/** 确认按钮选择器列表 */
const COMMIT_BUTTON_SELECTORS = [
  'div[class*="geetest_commit"]',
  'a[class*="geetest_commit"]',
  'button[class*="geetest_commit"]',
  'div[class*="geetest_submit"]',
  'a[class*="geetest_submit"]',
];

/**
 * TTShitu 文字点选验证码 Provider
 */
export class TTShituWorld extends BaseCaptchaProvider {
  readonly name = ProviderNames.TTSHITU;
  private client: TTShituClient;

  constructor(captchaInfo: CaptchaInfo, options?: TTShituOptions) {
    super(captchaInfo);
    this.client = new TTShituClient(options);
  }

  /**
   * 识别文字点选验证码
   */
  async solve(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
    try {
      logger.log("开始识别文字点选验证码");
      const result = await this.client.predict(
        request.image,
        TTShituTypeId.CLICK_1_4,
      );

      const points = this.parseClickPoints(result.result);

      if (points.length === 0) {
        return {
          code: CaptchaSolveCode.FAILED,
          message: `识别结果无效: ${result.result}`,
          data: { captchaId: result.id, points: [] },
        };
      }

      logger.log("识别成功, 坐标点:", points);
      return {
        code: CaptchaSolveCode.SUCCESS,
        message: "识别成功",
        data: { captchaId: result.id, points },
      };
    } catch (error) {
      logger.error("识别失败:", error);
      return {
        code: CaptchaSolveCode.FAILED,
        message: error instanceof Error ? error.message : "识别失败",
        data: { captchaId: "", points: [] },
      };
    }
  }

  /**
   * 解析点选坐标字符串
   * @param result TTShitu 返回的坐标字符串，格式: "x1,y1|x2,y2|x3,y3"
   */
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

  /**
   * 报告识别错误
   */
  async reportError(captchaId: string): Promise<CaptchaReportErrorResult> {
    try {
      logger.log("报告识别错误, captchaId:", captchaId);
      const result = await this.client.reportError(captchaId);
      logger.log("报错成功:", result.result);
      return { success: true, message: result.result };
    } catch (error) {
      logger.error("报错失败:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "报错失败",
      };
    }
  }

  /**
   * 执行 GeeTest 点选验证码 bypass
   */
  async bypassGeeTestClick(
    context: GeeTestClickBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult> {
    try {
      const { canvasWidth, canvasHeight, container } = context;
      const { points } = solveResult.data;

      if (points.length === 0) {
        return { success: false, message: "No points in solve result" };
      }

      const containerRect = container.getBoundingClientRect();
      const scaleFactorX = containerRect.width / canvasWidth;
      const scaleFactorY = containerRect.height / canvasHeight;

      logger.log("========== 点选调试信息 ==========");
      logger.log("Canvas 尺寸:", { width: canvasWidth, height: canvasHeight });
      logger.log("容器 DOM 尺寸:", {
        width: containerRect.width,
        height: containerRect.height,
      });
      logger.log("缩放比例:", { x: scaleFactorX, y: scaleFactorY });
      logger.log("识别返回的坐标点:", points);
      logger.log("=====================================");

      // 点击每个坐标点
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const currentRect = container.getBoundingClientRect();

        const scaledX = point.x * scaleFactorX;
        const scaledY = point.y * scaleFactorY;
        const clickX = currentRect.left + scaledX;
        const clickY = currentRect.top + scaledY;

        logger.log(`点击坐标 [${i + 1}/${points.length}]:`, {
          original: point,
          scaled: { x: scaledX, y: scaledY },
          screen: { x: clickX, y: clickY },
        });

        const elementAtPoint = this.getElementAtPoint(clickX, clickY);
        logger.log("点击位置的元素:", elementAtPoint?.className);

        await this.dispatchClickEvents(elementAtPoint, clickX, clickY);

        // 等待 GeeTest 处理点击
        const delay =
          i === 0
            ? CLICK_DELAY.max + 200
            : CLICK_DELAY.min +
              Math.random() * (CLICK_DELAY.max - CLICK_DELAY.min);
        logger.log(`等待 ${Math.round(delay)}ms 后继续...`);
        await this.sleep(delay);
      }

      // 点击确认按钮
      await this.sleep(300);
      await this.clickCommitButton(container);

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
      logger.log("检测到点击标记元素，尝试穿透...");
      element.style.pointerEvents = "none";
      element = document.elementFromPoint(x, y) as HTMLElement | null;
    }

    return element;
  }

  /**
   * 触发点击事件
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
    target.dispatchEvent(new MouseEvent("click", { ...eventInit, buttons: 0 }));
  }

  /**
   * 在容器内查找并点击 GeeTest 确认按钮
   */
  private async clickCommitButton(container: HTMLElement): Promise<void> {
    let button: HTMLElement | null = null;

    // 在容器内查找确认按钮
    for (const selector of COMMIT_BUTTON_SELECTORS) {
      button = container.querySelector<HTMLElement>(selector);
      if (button) {
        logger.log("找到确认按钮 (容器内):", button.className);
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

    logger.log("点击确认按钮:", { x, y });
    await this.dispatchClickEvents(button, x, y);
  }
}
