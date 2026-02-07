import { type JSX, memo, useCallback, useMemo } from "react";
import { captchaConfig } from "../core/config/captcha.config";
import { GeminiRecognizer } from "../core/recognizers";
import { ClickStrategy } from "../core/strategies/ClickStrategy";
import type { CaptchaTask } from "../types/api";
import GeetestV3Captcha from "./GeetestV3Captcha";
import { GeetestV4Captcha } from "./GeetestV4Captcha";

interface CaptchaSolverProps {
  task: CaptchaTask;
  onComplete?: (containerId: string) => void;
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
    const recognizer = new GeminiRecognizer();
    return new ClickStrategy(recognizer, task.type, {
      delay: { ...click.delay },
      debug: true,
    });
  }, [task.type]);

  // 将 onComplete(containerId) 绑定为无参回调，传递给子组件
  const handleComplete = useCallback(() => {
    onComplete?.(task.containerId);
  }, [onComplete, task.containerId]);

  console.log("Rendering Captcha Component for task:", task);

  return (
    <div
      id={task.containerId}
      className="captcha-isolation-container w-[340px] h-[386px]"
    >
      {!task.riskType ? (
        <GeetestV3Captcha
          task={task}
          strategy={strategy}
          onComplete={handleComplete}
        />
      ) : (
        <GeetestV4Captcha
          task={task}
          strategy={strategy}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
});

export default CaptchaSolver;
