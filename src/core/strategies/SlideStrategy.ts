import { findGeeTestElements } from "../../adapters/geetest/GeetestAdapter";
import { createModuleLogger } from "../../utils/logger";
import { drawDebugOverlay } from "../../utils/screenshot";
import {
  SlideRunner,
  type GeeTestSlideBypassContext,
  type SlideConfig,
} from "../bypass";
import type { IRecognizer } from "../recognizers";
import type { ISolveStrategy, SolveContext, SolveResult } from "./types";
const logger = createModuleLogger("SlideStrategy");

/**
 * 滑块求解策略
 * 组合识别器 + SlideRunner 完成滑块验证码求解
 */
export class SlideStrategy implements ISolveStrategy {
  readonly type = "slide" as const;
  private recognizer: IRecognizer;
  private runner: SlideRunner;

  constructor(recognizer: IRecognizer, slideConfig?: Partial<SlideConfig>) {
    this.recognizer = recognizer;
    this.runner = new SlideRunner(slideConfig);
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
      { image: base64, type: "slide" },
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

    const xPosition = recognizeResult.points[0].x;
    logger.log(`${this.recognizer.name}: 识别成功, X坐标:`, xPosition);

    // 3. Draw Debug Overlay
    const markedCanvas = drawDebugOverlay(canvas, {
      type: "vertical-line",
      points: [{ x: xPosition }],
      providerName: this.recognizer.name,
    });
    collector.addCapture("marked", markedCanvas.toDataURL("image/png"));

    // 保存 canvas 宽度用于后续计算，然后清理
    const canvasWidth = canvas.width;
    canvas.width = 0;
    canvas.height = 0;
    markedCanvas.width = 0;
    markedCanvas.height = 0;

    // 4. Find Elements
    const elements = findGeeTestElements(container);

    if (!elements.sliderBtn || !elements.sliderTrack) {
      throw new Error("未找到滑块按钮元素");
    }

    if (!elements.sliceElement || !elements.captchaWindow) {
      throw new Error("未找到拼图块元素");
    }

    // 5. Bypass
    const bypassContext: GeeTestSlideBypassContext = {
      container,
      sliderBtn: elements.sliderBtn,
      sliderTrack: elements.sliderTrack,
      sliceElement: elements.sliceElement,
      captchaWindow: elements.captchaWindow,
      canvasWidth: canvasWidth,
    };

    logger.log(`${this.recognizer.name}: 开始执行滑块 bypass...`);
    const bypassResult = await this.runner.execute(bypassContext, xPosition);

    if (!bypassResult.success) {
      throw new Error(
        `${this.recognizer.name} bypass 失败: ${bypassResult.message}`,
      );
    }

    return { recognizeResult, bypassResult };
  }
}
