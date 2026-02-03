import { type JSX, memo, useMemo } from "react";
import { captchaConfig } from "../core/config/captcha.config";
import { CaptchaType, GeminiRecognizer } from "../core/recognizers";
import { ClickStrategy } from "../core/strategies/ClickStrategy";
import { SlideStrategy } from "../core/strategies/SlideStrategy";
import type { CaptchaTask } from "../types/api";
import { GeetestV4Captcha } from "./GeetestV4Captcha";

interface CaptchaSolverProps {
  task: CaptchaTask;
  onComplete?: () => void;
}

/**
 * 统一验证码入口组件
 * 根据 task 自动选择识别器和策略
 */
export const CaptchaSolver = memo(function CaptchaSolver(
  props: CaptchaSolverProps,
): JSX.Element {
  const { task, onComplete } = props;

  const strategy = useMemo(() => {
    const { slide, click } = captchaConfig;

    if (task.type === "word") {
      const recognizer = new GeminiRecognizer();
      return new ClickStrategy(recognizer, CaptchaType.WORLD, {
        delay: { ...click.delay },
        debug: true,
      });
    }

    if (task.type === "icon") {
      const recognizer = new GeminiRecognizer();
      return new ClickStrategy(recognizer, CaptchaType.ICON, {
        delay: { ...click.delay },
        debug: true,
      });
    }

    // Default: slide with Gemini
    const recognizer = new GeminiRecognizer(undefined, {
      ...slide.gemini.cropConfig,
    });
    return new SlideStrategy(recognizer, {
      xOffset: slide.gemini.xOffset,
      slideSteps: slide.gemini.slideSteps,
      stepDelay: { min: 15, max: 25 },
      debug: true,
    });
  }, [task.type]);

  const renderCaptchaComponent = () => {
    switch (task.provider) {
      case "geetest_v4":
        return (
          <GeetestV4Captcha
            task={task}
            strategy={strategy}
            onComplete={onComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      id={task.containerId}
      className="captcha-isolation-container w-[340px] h-[386px]"
    >
      {renderCaptchaComponent()}
    </div>
  );
});

export default CaptchaSolver;
