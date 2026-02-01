import type {
  CaptchaApiConfig,
  CaptchaTask,
  FetchTasksResponse,
  SubmitResultRequest,
  SubmitResultResponse,
} from "../../types/api";
import { generateContainerId } from "../helpers";
import { createModuleLogger } from "../logger";

const logger = createModuleLogger("CaptchaTaskApi");

// 默认配置
const DEFAULT_CONFIG: CaptchaApiConfig = {
  baseUrl: import.meta.env.VITE_TASK_API_URL || "http://localhost:8080/api",
  pollInterval: 5000,
  maxConcurrent: 4,
  useMock: import.meta.env.DEV, // 开发环境默认使用mock
};

// Mock数据生成器
function generateMockTasks(): CaptchaTask[] {
  return [
    // {
    //   taskId: generateContainerId(),
    //   containerId: generateContainerId(),
    //   challenge: "1",
    //   geetestId: CAPTCHA_ID,
    //   provider: "geetest_v4",
    //   type: "slide",
    // },
    {
      taskId: generateContainerId(),
      containerId: generateContainerId(),
      challenge: "122ca1ba-0101-4b26-9842-63c0a1424cc2",
      geetestId: "54088bb07d2df3c46b79f80300b0abbe",
      provider: "geetest_v4",
      riskType: "word",
      type: "word",
    },
  ];
  // const types: Array<"slide" | "word" | "icon"> = ["slide", "word", "icon"];
  // return Array.from({ length: count }, (_, i) => ({
  //   taskId: `mock-task-${Date.now()}-${i}`,
  //   containerId: generateContainerId(),
  //   challenge: `mock-challenge-${Date.now()}-${i}`,
  //   geetestId: CAPTCHA_ID,
  //   provider: "geetest_v4" as const,
  //   type: types[i % types.length],
  //   createdAt: Date.now(),
  // }));
}

// 模拟网络延迟
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CaptchaTaskApi {
  private config: CaptchaApiConfig;

  constructor(config: Partial<CaptchaApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // 获取待处理的验证码任务
  async fetchTasks(): Promise<FetchTasksResponse> {
    if (this.config.useMock) {
      return this.mockFetchTasks();
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/tasks`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.tasks || [],
      };
    } catch (error) {
      logger.error("获取任务失败:", error);
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
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
    if (this.config.useMock) {
      return this.mockSubmitResult(request);
    }

    try {
      const response = await fetch(
        `${this.config.baseUrl}/tasks/${request.taskId}/result`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("提交结果失败:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Mock提交结果
  private async mockSubmitResult(
    _request: SubmitResultRequest,
  ): Promise<SubmitResultResponse> {
    await delay(200); // 模拟网络延迟
    return {
      success: true,
      message: "Mock result submitted successfully",
    };
  }

  // 更新配置
  updateConfig(config: Partial<CaptchaApiConfig>): void {
    this.config = { ...this.config, ...config };
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
