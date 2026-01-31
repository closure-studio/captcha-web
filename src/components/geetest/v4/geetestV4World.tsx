import { useCallback } from "react";
import {
  CaptchaSolveCode,
  CaptchaType as ProviderCaptchaType,
  type CaptchaSolveResult,
  type GeeTestClickBypassContext,
  type ICaptchaProvider,
} from "../../../utils/captcha/type/provider.ts";
import { findGeeTestElements } from "../../../utils/geetest/geetest.ts";
import { createModuleLogger } from "../../../utils/logger.ts";
import { drawDebugOverlay } from "../../../utils/screenshot.ts";
import type { GeeTestV4CaptchaProps } from "../../../types/captcha.ts";
import { GeetestV4Base } from "./GeetestV4Base.tsx";
import type { CaptchaCollector } from "./collector/useCaptchaCollector.ts";

const logger = createModuleLogger("GeeTestV4World");

/**
 * GeeTest v4 World Component
 * Uses GeetestV4Base and implements specific world (space inference) solving logic
 */
export function GeetestV4World(props: GeeTestV4CaptchaProps) {
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
        type: ProviderCaptchaType.WORLD,
      }, collector);

      if (solveResult.code !== CaptchaSolveCode.SUCCESS) {
        throw new Error(`${provider.name} 识别失败: ${solveResult.message}`);
      }

      if (solveResult.data.points.length === 0) {
        throw new Error(`${provider.name} 识别结果无效: 无坐标点`);
      }

      logger.log(
        `${provider.name}: 识别成功, 坐标点:`,
        solveResult.data.points,
        "ID:",
        solveResult.data.captchaId
      );

      // 3. Draw Debug Overlay
      const markedCanvas = drawDebugOverlay(canvas, {
        type: "click-points",
        points: solveResult.data.points,
        providerName: provider.name,
      });

      collector.addCapture("marked", markedCanvas.toDataURL("image/png"));

      // 4. Find Elements
      const elements = findGeeTestElements(container);

      if (!elements.captchaWindow) {
        logger.log(`${provider.name}: 元素调试:`, {
          captchaWindow: elements.captchaWindow,
        });
        throw new Error("未找到验证码图片窗口元素");
      }

      // 5. Bypass
      const bypassContext: GeeTestClickBypassContext = {
        container: container,
        captchaWindow: elements.captchaWindow,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      };

      if (!provider.bypassGeeTestClick) {
        throw new Error(`${provider.name} 不支持 GeeTest 点选 bypass`);
      }

      logger.log(`${provider.name}: 开始执行点选 (World) bypass...`);
      const bypassResult = await provider.bypassGeeTestClick(
        bypassContext,
        solveResult
      );

      if (!bypassResult.success) {
        throw new Error(`${provider.name} bypass 失败: ${bypassResult.message}`);
      }

      logger.log(`${provider.name}: 点选 (World) bypass 完成`);
      return solveResult;
    },
    [captchaInfo]
  );

  return <GeetestV4Base {...props} onAutoSolve={handleAutoSolve} />;
}

export default GeetestV4World;
