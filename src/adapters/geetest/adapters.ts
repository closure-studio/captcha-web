import type { CaptchaTask } from "../../types/api";
import type { GeeTestAdapter, GeeTestError, GeeTestInstance } from "../../types/geetest";
import { loadGeeTestV3Script, loadGeeTestV4Script } from "./GeetestSDK";

export const geetestV3Adapter: GeeTestAdapter = {
  version: "v3",
  loadScript: loadGeeTestV3Script,
  initCaptcha: (
    task: CaptchaTask,
    onError: (err: GeeTestError) => void,
    callback: (captcha: GeeTestInstance) => void,
  ) => {
    window.initGeetest!(
      {
        gt: task.gt || "",
        challenge: task.challenge,
        product: "float",
        lang: "zh-cn",
        onError,
      },
      callback as Parameters<NonNullable<typeof window.initGeetest>>[1],
    );
  },
  getGeetestId: (task: CaptchaTask) => task.gt,
  getEffectDeps: (task: CaptchaTask) => [task.gt, task.challenge],
};

export const geetestV4Adapter: GeeTestAdapter = {
  version: "v4",
  loadScript: loadGeeTestV4Script,
  initCaptcha: (
    task: CaptchaTask,
    onError: (err: GeeTestError) => void,
    callback: (captcha: GeeTestInstance) => void,
  ) => {
    window.initGeetest4!(
      {
        captchaId: task.geetestId || "",
        riskType: task.riskType,
        product: "float",
        language: "zh-cn",
        onError,
      },
      callback as Parameters<NonNullable<typeof window.initGeetest4>>[1],
    );
  },
  getGeetestId: (task: CaptchaTask) => task.geetestId,
  getEffectDeps: (task: CaptchaTask) => [task.geetestId, task.riskType],
};
