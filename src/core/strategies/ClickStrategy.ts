import { createModuleLogger } from "../../utils/logger";
import { drawDebugOverlay } from "../../utils/screenshot";
import { findGeeTestElements } from "../../adapters/geetest/GeetestAdapter";
import type { IRecognizer } from "../recognizers";
import { ClickRunner, type GeeTestClickBypassContext, type ClickConfig } from "../bypass";
import type { ISolveStrategy, SolveContext, SolveResult } from "./types";
import type { CaptchaType } from "../../types/api";

const logger = createModuleLogger("ClickStrategy");

/**
 * 点选求解策略
 * 组合识别器 + ClickRunner 完成点选验证码求解
 */
export class ClickStrategy implements ISolveStrategy {
  readonly type = "click" as const;
  private recognizer: IRecognizer;
  private runner: ClickRunner;
  private captchaType: CaptchaType;

  constructor(
    recognizer: IRecognizer,
    captchaType: CaptchaType,
    clickConfig?: Partial<ClickConfig>,
  ) {
    this.recognizer = recognizer;
    this.captchaType = captchaType;
    this.runner = new ClickRunner(clickConfig);
  }

  async solve(context: SolveContext): Promise<SolveResult> {
    const { container, containerId, collector } = context;

    // 1. Capture Screenshot
    const captureResult = await this.recognizer.capture(containerId);
    if (!captureResult) throw new Error("截图失败");

    const { base64, canvas } = captureResult;
    collector.addCapture("original", base64);

    // 2. Recognize
    const recognizeResult = await this.recognizer.recognize(
      { image: base64, type: this.captchaType },
      collector,
    );

    if (!recognizeResult.success) {
      // 清理 canvas 资源
      canvas.width = 0;
      canvas.height = 0;
      throw new Error(
        `${this.recognizer.name} 识别失败: ${recognizeResult.message}`,
      );
    }

    if (recognizeResult.points.length === 0) {
      // 清理 canvas 资源
      canvas.width = 0;
      canvas.height = 0;
      throw new Error(`${this.recognizer.name} 识别结果无效: 无坐标点`);
    }

    logger.log(`${this.recognizer.name}: 识别成功, 坐标点:`, recognizeResult.points);

    // 3. Draw Debug Overlay
    const markedCanvas = drawDebugOverlay(canvas, {
      type: "click-points",
      points: recognizeResult.points,
      providerName: this.recognizer.name,
    });
    collector.addCapture("marked", markedCanvas.toDataURL("image/png"));

    // 保存 canvas 尺寸用于后续计算，然后清理
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    canvas.width = 0;
    canvas.height = 0;
    markedCanvas.width = 0;
    markedCanvas.height = 0;

    // 4. Find Elements
    const elements = findGeeTestElements(container);

    if (!elements.captchaWindow) {
      throw new Error("未找到验证码图片窗口元素");
    }

    // 5. Bypass — 使用截图源元素作为缩放基准
    const screenshotElement = document.getElementById(containerId) || undefined;
    const bypassContext: GeeTestClickBypassContext = {
      container,
      captchaWindow: elements.captchaWindow,
      screenshotElement,
      canvasWidth: canvasWidth,
      canvasHeight: canvasHeight,
    };

    logger.log(`${this.recognizer.name}: 开始执行点选 bypass...`);
    const bypassResult = await this.runner.execute(
      bypassContext,
      recognizeResult.points,
    );

    if (!bypassResult.success) {
      throw new Error(
        `${this.recognizer.name} bypass 失败: ${bypassResult.message}`,
      );
    }

    return { recognizeResult, bypassResult };
  }
}
