// GeeTest v3 全局类型声明
declare global {
  interface Window {
    initGeetest?: (
      config: GeeTest3Config,
      callback: (captcha: GeeTest3Instance) => void
    ) => void;
  }
}

export interface GeeTest3Config {
  gt: string;
  challenge: string;
  product?: 'popup' | 'float' | 'bind';
  lang?: 'zh-cn' | 'en';
  timeout?: number;
  protocol?: 'http://' | 'https://';
  apiServers?: string[];
  staticServers?: string[];
  hideBar?: string[];
  offlineCb?: () => void;
  onError?: (error: GeeTest3Error) => void;
}

export interface GeeTest3Error {
  code: string;
  msg: string;
}

export interface GeeTest3ValidateResult {
  geetest_challenge: string;
  geetest_validate: string;
  geetest_seccode: string;
}

export interface GeeTest3Instance {
  // 基本方法
  appendTo: (selector: string | HTMLElement) => GeeTest3Instance;
  getValidate: () => GeeTest3ValidateResult | false;
  reset: () => GeeTest3Instance;
  showCaptcha: () => GeeTest3Instance;
  destroy: () => void;
  
  // 事件监听方法
  onReady: (callback: () => void) => GeeTest3Instance;
  onSuccess: (callback: () => void) => GeeTest3Instance;
  onFail: (callback: (error: GeeTest3Error) => void) => GeeTest3Instance;
  onError: (callback: (error: GeeTest3Error) => void) => GeeTest3Instance;
  onClose: (callback: () => void) => GeeTest3Instance;
}

export {};
