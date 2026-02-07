import axios from "axios";
import { createModuleLogger } from "../../logger";
import { CAPTCHA_SERVER_HOST } from "../../../consts/consts";
import type {
  RecognitionResponse,
  RecognitionClientOptions,
} from "../../../types/api";

const logger = createModuleLogger("Gemini Client");

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

  async solveSlider(image: string): Promise<RecognitionResponse> {
    const response = await axios.post<RecognitionResponse>(
      `${this.baseUrl}/solver/gemini/geetest/slider`,
      { image },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 90000,
      },
    );

    if (!response.data.success) {
      throw new Error("Gemini solveSlider error: Request failed");
    }

    return response.data;
  }

  async solveIcon(image: string): Promise<RecognitionResponse> {
    const response = await axios.post<RecognitionResponse>(
      `${this.baseUrl}/solver/gemini/geetest/icon`,
      { image },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 90000,
      },
    );

    if (!response.data.success) {
      throw new Error("Gemini solveIcon error: Request failed");
    }

    return response.data;
  }

  async solveWord(image: string): Promise<RecognitionResponse> {
    const response = await axios.post<RecognitionResponse>(
      `${this.baseUrl}/solver/gemini/geetest/word`,
      { image },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 90000,
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
