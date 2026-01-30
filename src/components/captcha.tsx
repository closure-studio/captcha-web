import { type JSX, useMemo } from "react";
import type { CaptchaInfo } from "../types/type";
import { CaptchaProviderFactory } from "../utils";
import GeetestV4Slider from "./geetest/v4/geetestV4Slider";
import GeetestV4Icon from "./geetest/v4/geetestV4Icon";
import GeetestV4World from "./geetest/v4/geetestV4World";

interface MyCaptchaSolverProps {
  captchaInfo: CaptchaInfo;
  handleComplete?: () => void;
}

export const MyCaptchaSolver = (props: MyCaptchaSolverProps): JSX.Element => {
  const { captchaInfo, handleComplete } = props;

  const provider = useMemo(() => {
    if (captchaInfo.type === "word") {
      return CaptchaProviderFactory.createTTShituWorld(captchaInfo, {});
    }
    if (captchaInfo.type === "icon") {
      return CaptchaProviderFactory.createTTShituSlider(captchaInfo, {});
    }
    if (captchaInfo.type === "slide") {
      return CaptchaProviderFactory.createTTShituSlider(captchaInfo, {});
    }
    return CaptchaProviderFactory.createTTShituSlider(captchaInfo, {});
  }, [captchaInfo]);

  // 根据 captchaInfo.provider 渲染不同的验证码组件
  const renderCaptchaComponent = () => {
    switch (captchaInfo.provider) {
      case "geetest_v4": {
        const commonProps = {
          captchaInfo,
          provider,
          onComplete: handleComplete,
        };

        switch (captchaInfo.type) {
          case "icon":
            return <GeetestV4Icon {...commonProps} />;
          case "word":
            return <GeetestV4World {...commonProps} />;
          case "slide":
          default:
            return <GeetestV4Slider {...commonProps} />;
        }
      }
      // 未来可扩展其他验证码类型
      default:
        return null;
    }
  };

  // should be a switcha case to support multiple providers in the future
  return (
    <div
      id={captchaInfo.containerId}
      // height 和 width 可根据需要调整
      // 使用 Tailwind 任意值语法: w-[宽度] h-[高度]
      className="captcha-isolation-container w-[340px] h-[386px]"
    >
      {renderCaptchaComponent()}
    </div>
  );
};
