/*
 * @Author: jackjieYYY 53422254+jackjieYYY@users.noreply.github.com
 * @Date: 2026-02-05 10:42:30
 * @LastEditors: jackjieYYY 53422254+jackjieYYY@users.noreply.github.com
 * @LastEditTime: 2026-02-05 10:57:51
 * @FilePath: /captcha-web/src/components/CaptchaSolver.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { type JSX, memo, useMemo } from "react";
import { captchaConfig } from "../core/config/captcha.config";
import { CaptchaType, GeminiRecognizer } from "../core/recognizers";
import { ClickStrategy } from "../core/strategies/ClickStrategy";
import type { CaptchaTask } from "../types/api";
import { GeetestV4Captcha } from "./GeetestV4Captcha";
import GeetestV3Captcha from "./GeetestV3Captcha";

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
    const { click } = captchaConfig;

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
    const recognizer = new GeminiRecognizer();
    return new ClickStrategy(recognizer, CaptchaType.ICON, {
      delay: { ...click.delay },
      debug: true,
    });
  }, [task.type]);

  const renderCaptchaComponent = () => {
    if (task.geetestId === "" && task.riskType === "") {
      return (
        <GeetestV3Captcha
          task={task}
          strategy={strategy}
          onComplete={onComplete}
        />
      );
    }
    return (
      <GeetestV4Captcha
        task={task}
        strategy={strategy}
        onComplete={onComplete}
      />
    );
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
