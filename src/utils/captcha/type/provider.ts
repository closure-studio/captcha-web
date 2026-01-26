/**
 * 验证码识别结果状态码
 */
export const CaptchaSolveCode = {
  /** 识别成功 */
  SUCCESS: "success",
  /** 识别失败 */
  FAILED: "failed",
} as const;

export type CaptchaSolveCodeValue =
  (typeof CaptchaSolveCode)[keyof typeof CaptchaSolveCode];

export const ProviderNames = {
  AEGIR: "Aegir",
  TTSHITU: "TTShitu",
} as const;

/**
 * 验证码类型
 */
export const CaptchaType = {
  /** 点选验证码 */
  CLICK: "click",
  /** 滑块验证码 */
  SLIDE: "slide",
} as const;

export type CaptchaTypeValue = (typeof CaptchaType)[keyof typeof CaptchaType];

/**
 * 坐标点
 */
export interface CaptchaPoint {
  x: number;
  y: number;
}

/**
 * 验证码识别结果数据
 */
export interface CaptchaSolveData {
  /** 验证码ID（用于报错） */
  captchaId: string;
  /** 坐标点数组（点选: 多个点; 滑块: 单个点，只需关注x坐标） */
  points: CaptchaPoint[];
}

/**
 * 验证码识别结果
 */
export interface CaptchaSolveResult {
  /** 结果消息 */
  message: string;
  /** 结果状态码 */
  code: CaptchaSolveCodeValue;
  /** 结果数据 */
  data: CaptchaSolveData;
}

/**
 * 验证码识别请求参数
 */
export interface CaptchaSolveRequest {
  /** Base64 编码的图片（不含 data:image/...;base64, 前缀） */
  image: string;
  /** 验证码类型 */
  type: CaptchaTypeValue;
  /** 背景图（部分滑块验证码需要） */
  backgroundImage?: string;
}

/**
 * 报错结果
 */
export interface CaptchaReportErrorResult {
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
}

/**
 * 验证码提供者接口
 */
export interface ICaptchaProvider {
  /** 提供者名称 */
  readonly name: string;

  /**
   * 识别验证码
   * @param request 识别请求参数
   * @returns 统一格式的识别结果
   */
  solve(request: CaptchaSolveRequest): Promise<CaptchaSolveResult>;

  /**
   * 报告识别错误
   * @param captchaId 验证码ID
   * @returns 报错结果
   */
  reportError(captchaId: string): Promise<CaptchaReportErrorResult>;
}
