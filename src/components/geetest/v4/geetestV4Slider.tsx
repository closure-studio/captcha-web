import { useCallback } from "react";
import {
  CaptchaSolveCode,
  CaptchaType as ProviderCaptchaType,
  type CaptchaSolveResult,
  type GeeTestSlideBypassContext,
  type ICaptchaProvider,
} from "../../../utils/captcha/type/provider.ts";
import { findGeeTestElements } from "../../../utils/geetest/geetest.ts";
import { createModuleLogger } from "../../../utils/logger.ts";
import { drawDebugOverlay } from "../../../utils/screenshot.ts";
import type { GeeTestV4CaptchaProps } from "../../../types/captcha.ts";
import { GeetestV4Base } from "./GeetestV4Base.tsx";
import type { CaptchaCollector } from "./collector/useCaptchaCollector.ts";

const logger = createModuleLogger("GeeTestV4Slider");

/**
 * GeeTest v4 Slider Component
 * Uses GeetestV4Base and implements specific slide solving logic
 */
export function GeetestV4Slider(props: GeeTestV4CaptchaProps) {
  const { captchaInfo } = props;

  const handleAutoSolve = useCallback(
    async (
      container: HTMLElement,
      provider: ICaptchaProvider,
      collector: CaptchaCollector,
    ): Promise<CaptchaSolveResult> => {
      // 1. Capture Screenshot
      const captureResult = await provider.capture(captchaInfo.containerId);
      if (!captureResult) throw new Error("截图失败");

      const { base64, canvas } = captureResult;
      collector.addCapture("original", base64);

      logger.log(`${provider.name}: 开始识别验证码...`);

      // 2. Solve
      const solveResult = await provider.solve({
        image: base64,
        type: ProviderCaptchaType.SLIDE,
      });

      if (solveResult.code !== CaptchaSolveCode.SUCCESS) {
        throw new Error(`${provider.name} 识别失败: ${solveResult.message}`);
      }

      if (solveResult.data.points.length === 0) {
        throw new Error(`${provider.name} 识别结果无效: 无坐标点`);
      }

      const xPosition = solveResult.data.points[0].x;
      logger.log(
        `${provider.name}: 识别成功, X坐标:`,
        xPosition,
        "ID:",
        solveResult.data.captchaId
      );

      // 3. Draw Debug Overlay
      const markedCanvas = drawDebugOverlay(canvas, {
        type: "vertical-line",
        points: [{ x: xPosition }],
        providerName: provider.name,
      });

      collector.addCapture("marked", markedCanvas.toDataURL("image/png"));

      // Add extra captures from solver (e.g., cropped image from Gemini)
      if (solveResult.data.extraCaptures) {
        for (const [name, base64] of Object.entries(solveResult.data.extraCaptures)) {
          collector.addCapture(name, base64);
        }
      }

      // 4. Find Elements
      const elements = findGeeTestElements(container);

      if (!elements.sliderBtn || !elements.sliderTrack) {
        logger.log(`${provider.name}: 滑块元素调试:`, {
          sliderContainer: elements.sliderContainer?.className,
          sliderBtn: elements.sliderBtn?.className,
          sliderTrack: elements.sliderTrack?.className,
        });
        throw new Error("未找到滑块按钮元素");
      }

      if (!elements.sliceElement || !elements.captchaWindow) {
        logger.log(`${provider.name}: 拼图块元素调试:`, {
          sliceElement: elements.sliceElement?.className,
          captchaWindow: elements.captchaWindow?.className,
        });
        throw new Error("未找到拼图块元素");
      }

      // 5. Bypass
      const bypassContext: GeeTestSlideBypassContext = {
        container: container,
        sliderBtn: elements.sliderBtn,
        sliderTrack: elements.sliderTrack,
        sliceElement: elements.sliceElement,
        captchaWindow: elements.captchaWindow,
        canvasWidth: canvas.width,
      };

      if (!provider.bypassGeeTestSlide) {
        throw new Error(`${provider.name} 不支持 GeeTest 滑块 bypass`);
      }

      logger.log(`${provider.name}: 开始执行滑块 bypass...`);
      const bypassResult = await provider.bypassGeeTestSlide(
        bypassContext,
        solveResult
      );

      if (!bypassResult.success) {
        throw new Error(`${provider.name} bypass 失败: ${bypassResult.message}`);
      }

      logger.log(`${provider.name}: 滑块 bypass 完成`);
      return solveResult;
    },
    [captchaInfo]
  );

  return <GeetestV4Base {...props} onAutoSolve={handleAutoSolve} />;
}

export default GeetestV4Slider;
