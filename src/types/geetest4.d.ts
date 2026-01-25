// GeeTest v4 全局类型声明
declare global {
  interface Window {
    initGeetest4?: (
      config: GeeTest4Config,
      callback: (captcha: GeeTest4Instance) => void
    ) => void;
  }
}

export interface GeeTest4Config {
  captchaId: string;
  product?: 'popup' | 'float' | 'bind';
  nativeButton?: {
    width?: string;
    height?: string;
  };
  rem?: number;
  language?: string;
  protocol?: 'http://' | 'https://';
  timeout?: number;
  hideBar?: string[];
  mask?: {
    outside?: boolean;
    bgColor?: string;
  };
  apiServers?: string[];
  nextWidth?: string;
  riskType?: string;
  offlineCb?: () => void;
  onError?: (error: GeeTest4Error) => void;
  userInfo?: string;
}

export interface GeeTest4Error {
  code: string;
  msg: string;
  desc?: {
    detail: string;
  };
}

export interface GeeTest4ValidateResult {
  lot_number: string;
  captcha_output: string;
  pass_token: string;
  gen_time: string;
}

export interface GeeTest4Instance {
  // 基本方法
  appendTo: (selector: string | HTMLElement) => GeeTest4Instance;
  getValidate: () => GeeTest4ValidateResult | false;
  reset: () => GeeTest4Instance;
  showCaptcha: () => GeeTest4Instance;
  destroy: () => void;
  
  // 事件监听方法
  onReady: (callback: () => void) => GeeTest4Instance;
  onSuccess: (callback: () => void) => GeeTest4Instance;
  onFail: (callback: (error: GeeTest4Error) => void) => GeeTest4Instance;
  onError: (callback: (error: GeeTest4Error) => void) => GeeTest4Instance;
  onClose: (callback: () => void) => GeeTest4Instance;
}

export {};
