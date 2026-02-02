import axios from "axios";
import { createModuleLogger } from "../../logger";

const logger = createModuleLogger("Nvidia Client");

// Nvidia API 使用 VITE_CAPTCHA_SERVER_HOST
const CAPTCHA_SERVER_HOST = import.meta.env.VITE_CAPTCHA_SERVER_HOST as string;

/**
 * Nvidia Slide API 响应数据
 */
export interface NvidiaSlideResponse {
  success: boolean;
  elapsed?: number;
  data: Array<{ x: number; y: number }>;
}

/**
 * Nvidia 客户端选项
 */
export interface NvidiaClientOptions {
  baseUrl?: string;
}

/**
 * Nvidia API 客户端
 */
export class NvidiaClient {
  private baseUrl: string;

  constructor(options: NvidiaClientOptions = {}) {
    this.baseUrl = options.baseUrl || CAPTCHA_SERVER_HOST;

    if (!this.baseUrl) {
      logger.warn(
        "Nvidia baseUrl not provided. Set VITE_CAPTCHA_SERVER_HOST environment variable or pass in options.",
      );
    }
  }

  /**
   * 识别滑块验证码
   * @param image Base64 编码的图片或 data URL
   * @returns 识别结果，包含坐标点数组
   */
  async solveSlider(image: string): Promise<NvidiaSlideResponse> {
    const response = await axios.post<NvidiaSlideResponse>(
      `${this.baseUrl}/solver/nvidia/geetest/slider`,
      { image },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    if (!response.data.success) {
      throw new Error("Nvidia solveSlider error: Request failed");
    }

    return response.data;
  }

  /**
   * 识别图标点选验证码
   * @param image Base64 编码的图片或 data URL
   * @returns 识别结果，包含坐标点数组
   */
  async solveIcon(image: string): Promise<NvidiaSlideResponse> {
    const response = await axios.post<NvidiaSlideResponse>(
      `${this.baseUrl}/solver/nvidia/geetest/icon`,
      { image },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    if (!response.data.success) {
      throw new Error("Nvidia solveIcon error: Request failed");
    }

    return response.data;
  }
}

// 默认客户端实例
let defaultClient: NvidiaClient | null = null;

/**
 * 获取默认客户端实例
 */
export function getDefaultNvidiaClient(): NvidiaClient {
  if (!defaultClient) {
    defaultClient = new NvidiaClient();
  }
  return defaultClient;
}

/**
 * 识别滑块验证码（使用默认客户端）
 */
export async function solveSlider(image: string): Promise<NvidiaSlideResponse> {
  return getDefaultNvidiaClient().solveSlider(image);
}

/**
 * 识别图标点选验证码（使用默认客户端）
 */
export async function solveIcon(image: string): Promise<NvidiaSlideResponse> {
  return getDefaultNvidiaClient().solveIcon(image);
}
