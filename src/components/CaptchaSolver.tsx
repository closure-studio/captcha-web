import { type JSX, memo, useCallback, useMemo } from "react";
import { geetestV3Adapter, geetestV4Adapter } from "../adapters/geetest/adapters";
import { captchaConfig } from "../core/config/captcha.config";
import { GeminiRecognizer } from "../core/recognizers";
import { ClickStrategy } from "../core/strategies/ClickStrategy";
import type { CaptchaTask } from "../types/api";
import { GeetestCaptcha } from "./GeetestCaptcha";

interface CaptchaSolverProps {
  task: CaptchaTask;
  completeTask: (containerId: string) => void;
}

/**
 * 统一验证码入口组件
 * 根据 task 自动选择识别器和策略
 */
export const CaptchaSolver = memo(function CaptchaSolver(
  props: CaptchaSolverProps,
): JSX.Element {
  const { task, completeTask } = props;

  const strategy = useMemo(() => {
    const { click } = captchaConfig;
    const recognizer = new GeminiRecognizer();
    return new ClickStrategy(recognizer, task.type, {
      delay: { ...click.delay },
      debug: true,
    });
  }, [task.type]);

  const handleComplete = useCallback(() => {
    completeTask(task.containerId);
  }, [completeTask, task.containerId]);

  const adapter = task.riskType ? geetestV4Adapter : geetestV3Adapter;

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
