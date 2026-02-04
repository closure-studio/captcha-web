import type {
  CaptchaApiConfig,
  CaptchaTask,
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
  useMock: import.meta.env.DEV, // 开发环境默认使用mock
};

// Mock数据生成器
function generateMockTasks(): CaptchaTask[] {
  const taskId = crypto.randomUUID();
  return [
    {
      taskId,
      containerId: taskId, // containerId 等于 taskId
      challenge: "122ca1ba-0101-4b26-9842-63c0a1424cc2",
      geetestId: "54088bb07d2df3c46b79f80300b0abbe",
      provider: "geetest_v4",
      riskType: "word",
      type: "word",
    },
  ];
}

// 模拟网络延迟
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CaptchaTaskApi {
  private config: CaptchaApiConfig;

  constructor(config: Partial<CaptchaApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // 同步基础 URL 到 captchaServerApi
    captchaServerApi.updateBaseUrl(this.config.baseUrl);
  }

  // 获取待处理的验证码任务
  async fetchTasks(): Promise<FetchTasksResponse> {
    if (this.config.useMock) {
      return this.mockFetchTasks();
    }

    return captchaServerApi.fetchTasks();
  }

  // Mock获取任务
  private async mockFetchTasks(): Promise<FetchTasksResponse> {
    await delay(300); // 模拟网络延迟
    return {
      success: true,
      data: generateMockTasks(),
    };
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
    // 同步基础 URL
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
