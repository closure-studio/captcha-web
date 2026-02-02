import axios from "axios";
import { createModuleLogger } from "../../logger";

const logger = createModuleLogger("Cloudflare Client");

// Cloudflare API 使用 VITE_CAPTCHA_SERVER_HOST
const CAPTCHA_SERVER_HOST = import.meta.env.VITE_CAPTCHA_SERVER_HOST as string;

/**
 * Cloudflare Slide API 响应数据
 */
export interface CloudflareSlideResponse {
  success: boolean;
  elapsed?: number;
  data: Array<{ x: number; y: number }>;
}

/**
 * Cloudflare 客户端选项
 */
export interface CloudflareClientOptions {
  baseUrl?: string;
}

/**
 * Cloudflare API 客户端
 */
export class CloudflareClient {
  private baseUrl: string;

  constructor(options: CloudflareClientOptions = {}) {
    this.baseUrl = options.baseUrl || CAPTCHA_SERVER_HOST;

    if (!this.baseUrl) {
      logger.warn(
        "Cloudflare baseUrl not provided. Set VITE_CAPTCHA_SERVER_HOST environment variable or pass in options.",
      );
    }
  }

  /**
   * 识别滑块验证码
   * @param image Base64 编码的图片或 data URL
   * @returns 识别结果，包含坐标点数组
   */
  async solveSlider(image: string): Promise<CloudflareSlideResponse> {
    const response = await axios.post<CloudflareSlideResponse>(
      `${this.baseUrl}/solver/cloudflare/geetest/slider`,
      { image },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    if (!response.data.success) {
      throw new Error("Cloudflare solveSlider error: Request failed");
    }

    return response.data;
  }

  /**
   * 识别图标点选验证码
   * @param image Base64 编码的图片或 data URL
   * @returns 识别结果，包含坐标点数组
   */
  async solveIcon(image: string): Promise<CloudflareSlideResponse> {
    const response = await axios.post<CloudflareSlideResponse>(
      `${this.baseUrl}/solver/cloudflare/geetest/icon`,
      { image },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    if (!response.data.success) {
      throw new Error("Cloudflare solveIcon error: Request failed");
    }

    return response.data;
  }
}

// 默认客户端实例
let defaultClient: CloudflareClient | null = null;

/**
 * 获取默认客户端实例
 */
export function getDefaultCloudflareClient(): CloudflareClient {
  if (!defaultClient) {
    defaultClient = new CloudflareClient();
  }
  return defaultClient;
}

/**
 * 识别滑块验证码（使用默认客户端）
 */
export async function solveSlider(image: string): Promise<CloudflareSlideResponse> {
  return getDefaultCloudflareClient().solveSlider(image);
}

/**
 * 识别图标点选验证码（使用默认客户端）
 */
export async function solveIcon(image: string): Promise<CloudflareSlideResponse> {
  return getDefaultCloudflareClient().solveIcon(image);
}
