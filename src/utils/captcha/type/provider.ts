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
 * GeeTest 滑块验证码 bypass 上下文
 * 包含容器内所有需要的 DOM 元素引用
 */
export interface GeeTestSlideBypassContext {
  /** 容器元素 */
  container: HTMLElement;
  /** 滑块按钮元素 */
  sliderBtn: HTMLElement;
  /** 滑块轨道元素 */
  sliderTrack: HTMLElement;
  /** 拼图块元素 */
  sliceElement: HTMLElement;
  /** 验证码图片窗口元素 */
  captchaWindow: HTMLElement;
  /** 截图 canvas 的宽度（用于计算缩放比例） */
  canvasWidth: number;
}

/**
 * GeeTest 点选验证码 bypass 上下文
 */
export interface GeeTestClickBypassContext {
  /** 容器元素 */
  container: HTMLElement;
  /** 验证码图片窗口元素 */
  captchaWindow: HTMLElement;
  /** 截图 canvas 的宽度（用于计算缩放比例） */
  canvasWidth: number;
  /** 截图 canvas 的高度（用于计算缩放比例） */
  canvasHeight: number;
}

/**
 * Bypass 执行结果
 */
export interface BypassResult {
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

  /**
   * 执行 GeeTest 滑块验证码 bypass
   * 不同的 provider 可能返回不同的坐标偏差，所以 bypass 逻辑由 provider 实现
   * @param context bypass 上下文，包含所需的 DOM 元素引用
   * @param solveResult 识别结果
   * @returns bypass 执行结果
   */
  bypassGeeTestSlide?(
    context: GeeTestSlideBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult>;

  /**
   * 执行 GeeTest 点选验证码 bypass
   * @param context bypass 上下文
   * @param solveResult 识别结果
   * @returns bypass 执行结果
   */
  bypassGeeTestClick?(
    context: GeeTestClickBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult>;
}
