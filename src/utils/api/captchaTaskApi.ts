import type {
  CaptchaApiConfig,
  FetchTasksResponse,
  SubmitResultRequest,
  SubmitResultResponse,
  SubmitTaskDetailedRequest,
  SubmitTaskDetailedResponse,
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
  async fetchTasks(limit: number = 1): Promise<FetchTasksResponse> {
    return captchaServerApi.fetchTasks(limit);
  }

  // 提交验证结果
  async submitResult(
    request: SubmitResultRequest,
  ): Promise<SubmitResultResponse> {
    return captchaServerApi.submitResult(request);
  }

  // 提交详细任务结果（包含识别记录、Bypass 记录和资产信息）
  async submitTaskDetailed(
    request: SubmitTaskDetailedRequest,
  ): Promise<SubmitTaskDetailedResponse> {
    return captchaServerApi.submitTaskDetailed(request);
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
