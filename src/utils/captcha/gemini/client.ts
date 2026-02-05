import axios from "axios";
import { createModuleLogger } from "../../logger";

const logger = createModuleLogger("Gemini Client");

// Gemini API 使用 VITE_CAPTCHA_SERVER_HOST
const CAPTCHA_SERVER_HOST = import.meta.env.VITE_CAPTCHA_SERVER_HOST as string;

/**
 * Gemini Slide API 响应数据
 */
export interface GeminiSlideResponse {
  success: boolean;
  elapsed?: number;
  data: Array<{ x: number; y: number }>;
}

/**
 * Gemini 客户端选项
 */
export interface GeminiClientOptions {
  baseUrl?: string;
}

/**
 * Gemini API 客户端
 */
export class GeminiClient {
  private baseUrl: string;

  constructor(options: GeminiClientOptions = {}) {
    this.baseUrl = options.baseUrl || CAPTCHA_SERVER_HOST;

    if (!this.baseUrl) {
      logger.warn(
        "Gemini baseUrl not provided. Set VITE_CAPTCHA_SERVER_HOST environment variable or pass in options.",
      );
    }
  }

  /**
   * 识别滑块验证码
   * @param image Base64 编码的图片或 data URL
   * @returns 识别结果，包含坐标点数组
   */
  async solveSlider(image: string): Promise<GeminiSlideResponse> {
    const response = await axios.post<GeminiSlideResponse>(
      `${this.baseUrl}/solver/gemini/geetest/slider`,
      { image },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    if (!response.data.success) {
      throw new Error("Gemini solveSlider error: Request failed");
    }

    return response.data;
  }

  /**
   * 识别图标点选验证码
   * @param image Base64 编码的图片或 data URL
   * @returns 识别结果，包含坐标点数组
   */
  async solveIcon(image: string): Promise<GeminiSlideResponse> {
    const response = await axios.post<GeminiSlideResponse>(
      `${this.baseUrl}/solver/gemini/geetest/icon`,
      { image },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    if (!response.data.success) {
      throw new Error("Gemini solveIcon error: Request failed");
    }

    return response.data;
  }

  /**
   * 识别图标点选验证码
   * @param image Base64 编码的图片或 data URL
   * @returns 识别结果，包含坐标点数组
   */
  async solveWord(image: string): Promise<GeminiSlideResponse> {
    const response = await axios.post<GeminiSlideResponse>(
      `${this.baseUrl}/solver/gemini/geetest/word`,
      { image },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    if (!response.data.success) {
      throw new Error("Gemini solveWord error: Request failed");
    }

    return response.data;
  }
}

// 默认客户端实例
let defaultClient: GeminiClient | null = null;

/**
 * 获取默认客户端实例
 */
export function getDefaultGeminiClient(): GeminiClient {
  if (!defaultClient) {
    defaultClient = new GeminiClient();
  }
  return defaultClient;
}

/**
 * 识别滑块验证码（使用默认客户端）
 */
export async function solveSlider(image: string): Promise<GeminiSlideResponse> {
  return getDefaultGeminiClient().solveSlider(image);
}

/**
 * 识别图标点选验证码（使用默认客户端）
 */
export async function solveIcon(image: string): Promise<GeminiSlideResponse> {
  return getDefaultGeminiClient().solveIcon(image);
}
