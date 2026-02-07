import axios from "axios";
import { createModuleLogger } from "../../logger";
import { CAPTCHA_SERVER_HOST } from "../../../consts/consts";
import type {
  RecognitionResponse,
  RecognitionClientOptions,
} from "../../../types/api";

const logger = createModuleLogger("Nvidia Client");

/**
 * Nvidia API 客户端
 */
export class NvidiaClient {
  private baseUrl: string;

  constructor(options: RecognitionClientOptions = {}) {
    this.baseUrl = options.baseUrl || CAPTCHA_SERVER_HOST;

    if (!this.baseUrl) {
      logger.warn(
        "Nvidia baseUrl not provided. Set VITE_CAPTCHA_SERVER_HOST environment variable or pass in options.",
      );
    }
  }

  async solveSlider(image: string): Promise<RecognitionResponse> {
    const response = await axios.post<RecognitionResponse>(
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

  async solveIcon(image: string): Promise<RecognitionResponse> {
    const response = await axios.post<RecognitionResponse>(
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

export function getDefaultNvidiaClient(): NvidiaClient {
  if (!defaultClient) {
    defaultClient = new NvidiaClient();
  }
  return defaultClient;
}

export async function solveSlider(image: string): Promise<RecognitionResponse> {
  return getDefaultNvidiaClient().solveSlider(image);
}

export async function solveIcon(image: string): Promise<RecognitionResponse> {
  return getDefaultNvidiaClient().solveIcon(image);
}
