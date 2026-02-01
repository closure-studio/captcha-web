import { createModuleLogger } from "../../utils/logger";
import { drawDebugOverlay } from "../../utils/screenshot";
import { findGeeTestElements } from "../../adapters/geetest/GeetestAdapter";
import type { IRecognizer, CaptchaTypeValue } from "../recognizers";
import { ClickRunner, type GeeTestClickBypassContext, type ClickConfig } from "../bypass";
import type { ISolveStrategy, SolveContext, SolveResult } from "./types";

const logger = createModuleLogger("ClickStrategy");

/**
 * 点选求解策略
 * 组合识别器 + ClickRunner 完成点选验证码求解
 */
export class ClickStrategy implements ISolveStrategy {
  readonly type = "click" as const;
  private recognizer: IRecognizer;
  private runner: ClickRunner;
  private captchaType: CaptchaTypeValue;

  constructor(
    recognizer: IRecognizer,
    captchaType: CaptchaTypeValue,
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

    logger.log(`${this.recognizer.name}: 开始识别验证码...`);

    // 2. Recognize
    const recognizeResult = await this.recognizer.recognize(
      { image: base64, type: this.captchaType },
      collector,
    );

    if (!recognizeResult.success) {
      throw new Error(
        `${this.recognizer.name} 识别失败: ${recognizeResult.message}`,
      );
    }

    if (recognizeResult.points.length === 0) {
      throw new Error(`${this.recognizer.name} 识别结果无效: 无坐标点`);
    }

    logger.log(
      `${this.recognizer.name}: 识别成功, 坐标点:`,
      recognizeResult.points,
      "ID:",
      recognizeResult.captchaId,
    );

    // 3. Draw Debug Overlay
    const markedCanvas = drawDebugOverlay(canvas, {
      type: "click-points",
      points: recognizeResult.points,
      providerName: this.recognizer.name,
    });
    collector.addCapture("marked", markedCanvas.toDataURL("image/png"));

    // 4. Find Elements
    const elements = findGeeTestElements(container);

    if (!elements.captchaWindow) {
      logger.log(`${this.recognizer.name}: 元素调试:`, {
        captchaWindow: elements.captchaWindow,
      });
      throw new Error("未找到验证码图片窗口元素");
    }

    // 5. Bypass
    const bypassContext: GeeTestClickBypassContext = {
      container,
      captchaWindow: elements.captchaWindow,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
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

    logger.log(`${this.recognizer.name}: 点选 bypass 完成`);
    return { recognizeResult, bypassResult };
  }
}
