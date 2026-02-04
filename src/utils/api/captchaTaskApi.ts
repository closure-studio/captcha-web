import type {
  CaptchaApiConfig,
  FetchTasksResponse,
  SubmitResultRequest,
  SubmitResultResponse,
} from "../../types/api";
import { captchaServerApi } from "./captchaServerApi";


// 默认配置
const DEFAULT_CONFIG: CaptchaApiConfig = {
  baseUrl: import.meta.env.VITE_CAPTCHA_SERVER_HOST || "http://localhost:8787",
  pollInterval: 5000,
  maxConcurrent: 4,
};

class CaptchaTaskApi {
  private config: CaptchaApiConfig;

  constructor(config: Partial<CaptchaApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    captchaServerApi.updateBaseUrl(this.config.baseUrl);
  }

  // 获取待处理的验证码任务
  async fetchTasks(): Promise<FetchTasksResponse> {
    return captchaServerApi.fetchTasks();
  }

  // 提交验证结果
  async submitResult(
    request: SubmitResultRequest,
  ): Promise<SubmitResultResponse> {
    return captchaServerApi.submitResult(request);
  }

  // 更新配置
  updateConfig(config: Partial<CaptchaApiConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.baseUrl) {
      captchaServerApi.updateBaseUrl(config.baseUrl);
    }
  }

  // 获取当前配置
  getConfig(): CaptchaApiConfig {
    return { ...this.config };
  }
}

// 导出单例
export const captchaTaskApi = new CaptchaTaskApi();

// 也导出类以便需要多实例时使用
export { CaptchaTaskApi };
