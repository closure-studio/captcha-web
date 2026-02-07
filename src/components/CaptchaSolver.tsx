import { type JSX, memo, useCallback, useMemo } from "react";
import { geetestV3Adapter, geetestV4Adapter } from "../adapters/geetest/adapters";
import { captchaConfig } from "../core/config/captcha.config";
import { GeminiRecognizer } from "../core/recognizers";
import { ClickStrategy } from "../core/strategies/ClickStrategy";
import type { CaptchaTask } from "../types/api";
import { GeetestCaptcha } from "./GeetestCaptcha";

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

  const adapter = task.riskType ? geetestV4Adapter : geetestV3Adapter;

  console.log("Rendering Captcha Component for task:", task);

  return (
    <div
      id={task.containerId}
      className="captcha-isolation-container w-[340px] h-[386px]"
    >
      <GeetestCaptcha
        task={task}
        strategy={strategy}
        adapter={adapter}
        onComplete={handleComplete}
      />
    </div>
  );
});

export default CaptchaSolver;
