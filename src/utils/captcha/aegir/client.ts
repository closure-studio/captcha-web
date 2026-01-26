import axios from "axios";

// Aegir Captcha API 基础 URL
const AEGIR_API_URL = "http://114.132.98.164:8899";

/**
 * Aegir Captcha 请求参数
 */
export interface AegirCaptchaRequest {
  /** Base64 编码的图片（不含 data:image/...;base64, 前缀） */
  raw_base64: string;
}

/**
 * Aegir Captcha 响应数据
 */
export interface AegirCaptchaResponse {
  /** 处理时间（毫秒） */
  time: number;
  /** 响应消息 */
  message: string;
  /** 响应状态码 */
  code: number;
  /** 响应数据 */
  data: AegirCaptchaData;
}

/**
 * Aegir Captcha 数据
 */
export interface AegirCaptchaData {
  /** 验证码ID */
  captcha_id: string;
  /** 点选坐标点数组，格式为 ["x,y", "x,y", ...] */
  points: string[];
  /** 矩形区域 */
  rectangles: unknown[];
  /** YOLO 检测数据 */
  yolo_data: unknown[];
}

/**
 * 解析后的坐标点
 */
export interface AegirPoint {
  x: number;
  y: number;
}

/**
 * Aegir 客户端选项
 */
export interface AegirOptions {
  baseUrl?: string;
  /** 请求超时时间（毫秒），默认 60000 */
  timeout?: number;
}

/**
 * Aegir Captcha API 客户端
 */
export class AegirClient {
  private baseUrl: string;
  private timeout: number;

  constructor(options: AegirOptions = {}) {
    this.baseUrl = options.baseUrl || AEGIR_API_URL;
    this.timeout = options.timeout || 60000;
  }

  /**
   * 识别验证码坐标
   * @param rawBase64 Base64 编码的图片（不含 data:image/...;base64, 前缀）
   * @returns 识别结果
   */
  async selectCaptcha(rawBase64: string): Promise<AegirCaptchaResponse> {
    const requestBody: AegirCaptchaRequest = {
      raw_base64: rawBase64,
    };

    const response = await axios.post<AegirCaptchaResponse>(
      `${this.baseUrl}/captcha/select/base64`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
        },
        timeout: this.timeout,
      },
    );

    if (response.data.message !== "success") {
      throw new Error(`Aegir captcha error: ${response.data.message}`);
    }

    return response.data;
  }

  /**
   * 识别验证码并返回解析后的坐标点
   * @param rawBase64 Base64 编码的图片（不含 data:image/...;base64, 前缀）
   * @returns 解析后的坐标点数组
   */
  async selectCaptchaPoints(rawBase64: string): Promise<AegirPoint[]> {
    const response = await this.selectCaptcha(rawBase64);
    return this.parsePoints(response.data.points);
  }

  /**
   * 解析坐标点字符串数组为坐标对象数组
   * @param points 坐标点字符串数组，格式为 ["x, y", "x, y", ...]
   * @returns 解析后的坐标点数组
   */
  parsePoints(points: string[]): AegirPoint[] {
    return points
      .map((point) => {
        // 处理可能的空格，如 "282.5, 228" 或 "282.5,228"
        const parts = point.split(",").map((p) => p.trim());
        if (parts.length !== 2) {
          return null;
        }
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        // 过滤无效坐标（如 "0,0"）
        if (isNaN(x) || isNaN(y) || (x === 0 && y === 0)) {
          return null;
        }
        return { x, y };
      })
      .filter((point): point is AegirPoint => point !== null);
  }

  /**
   * 识别验证码并返回有效的坐标点（过滤掉0,0等无效点）
   * @param rawBase64 Base64 编码的图片（不含 data:image/...;base64, 前缀）
   * @returns 有效的坐标点数组
   */
  async selectValidPoints(rawBase64: string): Promise<AegirPoint[]> {
    return this.selectCaptchaPoints(rawBase64);
  }
}

// 默认客户端实例
let defaultClient: AegirClient | null = null;

/**
 * 获取默认客户端实例
 */
export function getDefaultAegirClient(): AegirClient {
  if (!defaultClient) {
    defaultClient = new AegirClient();
  }
  return defaultClient;
}

/**
 * 设置默认客户端实例
 */
export function setDefaultAegirClient(client: AegirClient): void {
  defaultClient = client;
}

/**
 * 识别验证码坐标（使用默认客户端）
 * @param rawBase64 Base64 编码的图片
 * @returns 完整响应数据
 */
export async function selectCaptcha(
  rawBase64: string,
): Promise<AegirCaptchaResponse> {
  return getDefaultAegirClient().selectCaptcha(rawBase64);
}

/**
 * 识别验证码并返回解析后的坐标点（使用默认客户端）
 * @param rawBase64 Base64 编码的图片
 * @returns 解析后的坐标点数组
 */
export async function selectCaptchaPoints(
  rawBase64: string,
): Promise<AegirPoint[]> {
  return getDefaultAegirClient().selectCaptchaPoints(rawBase64);
}

/**
 * 识别验证码并返回有效的坐标点（使用默认客户端）
 * @param rawBase64 Base64 编码的图片
 * @returns 有效的坐标点数组
 */
export async function selectValidPoints(
  rawBase64: string,
): Promise<AegirPoint[]> {
  return getDefaultAegirClient().selectValidPoints(rawBase64);
}
