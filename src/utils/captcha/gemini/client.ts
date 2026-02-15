import axios from "axios";
import { createModuleLogger } from "../../logger";
import { CAPTCHA_SERVER_HOST } from "../../../consts/consts";
import type {
  RecognitionResponse,
  RecognitionClientOptions,
} from "../../../types/api";

const logger = createModuleLogger("Gemini Client");

// Axios 请求配置
const AXIOS_CONFIG = {
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 90000,
};

/**
 * Gemini API 客户端
 */
export class GeminiClient {
  private baseUrl: string;

  constructor(options: RecognitionClientOptions = {}) {
    this.baseUrl = options.baseUrl || CAPTCHA_SERVER_HOST;

    if (!this.baseUrl) {
      logger.warn(
        "Gemini baseUrl not provided. Set VITE_CAPTCHA_SERVER_HOST environment variable or pass in options.",
      );
    }
  }

  /**
   * 发送单个请求
   */
  private async sendRequest(
    endpoint: string,
    image: string,
  ): Promise<RecognitionResponse> {
    const response = await axios.post<RecognitionResponse>(
      `${this.baseUrl}${endpoint}`,
      { image },
      AXIOS_CONFIG,
    );

    if (!response.data.success) {
      throw new Error(`Gemini ${endpoint} error: Request failed`);
    }

    return response.data;
  }

  /**
   * 发送两个请求，返回先完成的响应
   */
  private async raceRequest(
    endpoint: string,
    image: string,
  ): Promise<RecognitionResponse> {
    const request1 = this.sendRequest(endpoint, image);
    const request2 = this.sendRequest(endpoint, image);

    return Promise.race([request1, request2]);
  }

  async solveSlider(image: string): Promise<RecognitionResponse> {
    return this.raceRequest("/solver/gemini/geetest/slider", image);
  }

  async solveIcon(image: string): Promise<RecognitionResponse> {
    return this.raceRequest("/solver/gemini/geetest/icon", image);
  }

  async solveWord(image: string): Promise<RecognitionResponse> {
    return this.raceRequest("/solver/gemini/geetest/word", image);
  }
}

// 默认客户端实例
let defaultClient: GeminiClient | null = null;

export function getDefaultGeminiClient(): GeminiClient {
  if (!defaultClient) {
    defaultClient = new GeminiClient();
  }
  return defaultClient;
}

export async function solveSlider(image: string): Promise<RecognitionResponse> {
  return getDefaultGeminiClient().solveSlider(image);
}

export async function solveIcon(image: string): Promise<RecognitionResponse> {
  return getDefaultGeminiClient().solveIcon(image);
}
