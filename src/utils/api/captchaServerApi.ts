/**
 * Captcha Server API Client
 *
 * 基于 docs/api-reference.md 实现的服务端 API 封装
 * 使用 VITE_CAPTCHA_SERVER_HOST 作为基础 URL
 */

import axios, { type AxiosInstance } from "axios";
import type {
  ApiResponse,
  CaptchaTask,
  CreateTaskRequest,
  CreateTaskResponse,
  FetchTasksResponse,
  OverviewStats,
  RecognizerStats,
  StatsInterval,
  StatsQueryParams,
  StatsResponse,
  SubmitResultRequest,
  SubmitResultResponse,
  TrendStats,
  TypeStats
} from "../../types/api";
import { createModuleLogger } from "../logger";

const logger = createModuleLogger("CaptchaServerApi");

// 获取服务器基础 URL
const CAPTCHA_SERVER_HOST =
  import.meta.env.VITE_CAPTCHA_SERVER_HOST || "http://localhost:8787";

/**
 * Captcha Server API 客户端
 *
 * 提供完整的任务管理和统计 API 封装
 */
export class CaptchaServerApi {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || CAPTCHA_SERVER_HOST;
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api`,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // ============ 任务管理 ============

  /**
   * 获取待处理任务列表
   * GET /api/tasks?limit={limit}
   */
  async fetchTasks(limit: number = 10): Promise<FetchTasksResponse> {
    try {
      const response = await this.client.get<{ success: boolean; tasks: CaptchaTask[] }>(
        "/tasks",
        { params: { limit: Math.min(limit, 100) } }
      );

      return {
        success: response.data.success,
        data: response.data.tasks || [],
      };
    } catch (error) {
      logger.error("获取任务失败:", error);
      return {
        success: false,
        data: [],
        message: this.getErrorMessage(error),
      };
    }
  }

  /**
   * 创建新任务
   * POST /api/tasks
   */
  async createTask(request: CreateTaskRequest): Promise<CreateTaskResponse> {
    try {
      const response = await this.client.post<CreateTaskResponse>("/tasks", request);
      return response.data;
    } catch (error) {
      logger.error("创建任务失败:", error);
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  /**
   * 提交任务结果
   * POST /api/tasks/{taskId}
   */
  async submitResult(request: SubmitResultRequest): Promise<SubmitResultResponse> {
    const { taskId, containerId, ...body } = request;
    void containerId; // containerId 仅本地使用，不发送到服务器

    try {
      const response = await this.client.post<SubmitResultResponse>(
        `/tasks/${taskId}`,
        body
      );
      return response.data;
    } catch (error) {
      logger.error("提交结果失败:", error);
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  // ============ 统计查询 ============

  /**
   * 获取总览统计
   * GET /api/stats?view=overview
   */
  async getOverviewStats(
    from?: number,
    to?: number
  ): Promise<StatsResponse<OverviewStats>> {
    return this.getStats<OverviewStats>({ view: "overview", from, to });
  }

  /**
   * 获取按类型统计
   * GET /api/stats?view=by-type
   */
  async getStatsByType(
    from?: number,
    to?: number
  ): Promise<StatsResponse<TypeStats[]>> {
    return this.getStats<TypeStats[]>({ view: "by-type", from, to });
  }

  /**
   * 获取按识别器统计
   * GET /api/stats?view=by-recognizer
   */
  async getStatsByRecognizer(
    from?: number,
    to?: number
  ): Promise<StatsResponse<RecognizerStats[]>> {
    return this.getStats<RecognizerStats[]>({ view: "by-recognizer", from, to });
  }

  /**
   * 获取时间趋势统计
   * GET /api/stats?view=trend&interval={interval}
   */
  async getTrendStats(
    interval: StatsInterval = "hour",
    from?: number,
    to?: number
  ): Promise<StatsResponse<TrendStats[]>> {
    return this.getStats<TrendStats[]>({ view: "trend", interval, from, to });
  }

  /**
   * 通用统计查询
   * GET /api/stats
   */
  async getStats<T>(params: StatsQueryParams): Promise<StatsResponse<T>> {
    try {
      const response = await this.client.get<StatsResponse<T>>("/stats", {
        params,
      });
      return response.data;
    } catch (error) {
      logger.error("获取统计失败:", error);
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  // ============ 健康检查 ============

  /**
   * 检查服务健康状态
   */
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      logger.error("健康检查失败:", error);
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  // ============ 辅助方法 ============

  /**
   * 更新基础 URL
   */
  updateBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
    this.client.defaults.baseURL = `${baseUrl}/api`;
  }

  /**
   * 获取当前配置
   */
  getConfig(): { baseUrl: string } {
    return { baseUrl: this.baseUrl };
  }

  /**
   * 从错误对象提取错误消息
   */
  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      // 优先使用服务器返回的错误消息
      const serverError = error.response?.data?.error;
      if (serverError) return serverError;

      // 网络错误
      if (error.code === "ERR_NETWORK") {
        return "网络连接失败";
      }

      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Unknown error";
  }
}

// 导出默认实例
export const captchaServerApi = new CaptchaServerApi();

// 也导出类以便需要多实例时使用
export { CaptchaServerApi as CaptchaServerApiClass };
