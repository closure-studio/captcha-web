import type { CaptchaTask } from "./api";

// Common GeeTest error shape (identical in V3 and V4)
export interface GeeTestError {
  code: string;
  msg: string;
}

// Common GeeTest instance interface (V3 and V4 share identical method signatures)
export interface GeeTestInstance {
  appendTo: (selector: string | HTMLElement) => GeeTestInstance;
  getValidate: () => Record<string, string> | false;
  reset: () => GeeTestInstance;
  destroy: () => void;
  onReady: (cb: () => void) => GeeTestInstance;
  onSuccess: (cb: () => void) => GeeTestInstance;
  onFail: (cb: (err: GeeTestError) => void) => GeeTestInstance;
  onError: (cb: (err: GeeTestError) => void) => GeeTestInstance;
  onClose: (cb: () => void) => GeeTestInstance;
}

// Adapter interface: encapsulates version-specific SDK init logic
export interface GeeTestAdapter {
  version: "v3" | "v4";
  loadScript: () => Promise<void>;
  initCaptcha: (
    task: CaptchaTask,
    onError: (err: GeeTestError) => void,
    callback: (captcha: GeeTestInstance) => void,
  ) => void;
  getGeetestId: (task: CaptchaTask) => string | undefined;
  getEffectDeps: (task: CaptchaTask) => unknown[];
}
