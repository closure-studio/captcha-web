import axios from "axios";
import { createModuleLogger } from "../../logger";
import { CAPTCHA_SERVER_HOST } from "../../../consts/consts";
import type {
  RecognitionResponse,
  RecognitionClientOptions,
} from "../../../types/api";

const logger = createModuleLogger("Cloudflare Client");

/**
 * Cloudflare API 客户端
 */
export class CloudflareClient {
  private baseUrl: string;

  constructor(options: RecognitionClientOptions = {}) {
    this.baseUrl = options.baseUrl || CAPTCHA_SERVER_HOST;

    if (!this.baseUrl) {
      logger.warn(
        "Cloudflare baseUrl not provided. Set VITE_CAPTCHA_SERVER_HOST environment variable or pass in options.",
      );
    }
  }

  async solveSlider(image: string): Promise<RecognitionResponse> {
    const response = await axios.post<RecognitionResponse>(
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

  async solveIcon(image: string): Promise<RecognitionResponse> {
    const response = await axios.post<RecognitionResponse>(
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

export function getDefaultCloudflareClient(): CloudflareClient {
  if (!defaultClient) {
    defaultClient = new CloudflareClient();
  }
  return defaultClient;
}

export async function solveSlider(image: string): Promise<RecognitionResponse> {
  return getDefaultCloudflareClient().solveSlider(image);
}

export async function solveIcon(image: string): Promise<RecognitionResponse> {
  return getDefaultCloudflareClient().solveIcon(image);
}
