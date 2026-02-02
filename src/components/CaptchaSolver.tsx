import { type JSX, memo, useCallback, useMemo } from "react";
import { captchaConfig } from "../core/config/captcha.config";
import { CaptchaType, NvidiaRecognizer } from "../core/recognizers";
import { ClickStrategy } from "../core/strategies/ClickStrategy";
import { SlideStrategy } from "../core/strategies/SlideStrategy";
import type { CaptchaInfo } from "../types/type";
import { GeetestV4Captcha } from "./GeetestV4Captcha";

interface CaptchaSolverProps {
  captchaInfo: CaptchaInfo;
  onComplete?: (containerId: string) => void;
}

/**
 * 统一验证码入口组件
 * 根据 captchaInfo 自动选择识别器和策略
 */
export const CaptchaSolver = memo(function CaptchaSolver(
  props: CaptchaSolverProps
): JSX.Element {
  const { captchaInfo, onComplete } = props;

  const strategy = useMemo(() => {
    const { slide, click } = captchaConfig;

    if (captchaInfo.type === "word") {
      const recognizer = new NvidiaRecognizer();
      return new ClickStrategy(recognizer, CaptchaType.WORLD, {
        delay: { ...click.delay },
        debug: true,
      });
    }

    if (captchaInfo.type === "icon") {
      const recognizer = new NvidiaRecognizer();
      return new ClickStrategy(recognizer, CaptchaType.ICON, {
        delay: { ...click.delay },
        debug: true,
      });
    }

    // Default: slide with Gemini
    const recognizer = new NvidiaRecognizer(undefined, {
      ...slide.gemini.cropConfig,
    });
    return new SlideStrategy(recognizer, {
      xOffset: slide.gemini.xOffset,
      slideSteps: slide.gemini.slideSteps,
      stepDelay: { min: 15, max: 25 },
      debug: true,
    });
  }, [captchaInfo.type]);

  const handleComplete = useCallback(() => {
    onComplete?.(captchaInfo.containerId);
  }, [onComplete, captchaInfo.containerId]);

  const renderCaptchaComponent = () => {
    switch (captchaInfo.provider) {
      case "geetest_v4":
        return (
          <GeetestV4Captcha
            captchaInfo={captchaInfo}
            strategy={strategy}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      id={captchaInfo.containerId}
      className="captcha-isolation-container w-[340px] h-[386px]"
    >
      {renderCaptchaComponent()}
    </div>
  );
});

export default CaptchaSolver;
