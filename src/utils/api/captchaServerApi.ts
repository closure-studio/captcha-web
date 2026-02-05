/**
 * Captcha Server API Client
 *
 * 基于上游 API 文档实现的服务端 API 封装
 * 使用 VITE_CAPTCHA_SERVER_HOST 作为基础 URL
 *
 * API 端点:
 * - GET /captcha/reqs?limit={limit} - 获取验证码请求
 * - POST /captcha/resp - 提交验证码结果
 */

import axios, { type AxiosInstance } from "axios";
import type {
  ApiResponse,
  CaptchaTask,
  CaptchaType,
  FetchTasksResponse,
  OverviewStats,
  RecognizerStats,
  StatsInterval,
  StatsQueryParams,
  StatsResponse,
  SubmitResultRequest,
  SubmitResultResponse,
  TrendStats,
  TypeStats,
} from "../../types/api";
import type { CaptchaInfo } from "../../types/type";
import { createModuleLogger } from "../logger";

const logger = createModuleLogger("CaptchaServerApi");

// 获取服务器基础 URL
const CAPTCHA_SERVER_HOST =
  import.meta.env.VITE_CAPTCHA_SERVER_HOST || "http://localhost:8787";

// 上游 API 响应格式
interface UpstreamApiResponse<T> {
  code: number; // 1 = success, 0 = failure
  data: T;
  message: string;
}

// 提交 V4 结果请求体
interface SubmitV4ResultBody {
  challenge: string;
  lot_number: string;
  pass_token: string;
  gen_time: string;
  captcha_output: string;
}

// 提交 V3 结果请求体
interface SubmitV3ResultBody {
  challenge: string;
  geetest_challenge: string;
  geetest_validate: string;
  geetest_seccode: string;
}

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
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // ============ 任务管理 ============

  /**
   * 获取待处理任务列表
   * GET /captcha/reqs?limit={limit}
   *
   * 注意：数据获取后会被上游服务器删除，只能获取一次
   */
  async fetchTasks(limit: number = 1): Promise<FetchTasksResponse> {
    try {
      // 上游返回的数据直接符合 CaptchaInfo 结构（除了部分字段名差异）
      const response = await this.client.get<
        UpstreamApiResponse<CaptchaInfo[]>
      >("/captcha/reqs", { params: { limit } });

      const { code, data, message } = response.data;

      if (code !== 1) {
        return {
          success: false,
          data: [],
          message,
        };
      }

      // 将上游数据转换为本地 CaptchaTask 格式
      const tasks: CaptchaTask[] = (data || []).map((info) =>
        this.mapToTask(info),
      );

      return {
        success: true,
        data: tasks,
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
   * 将 CaptchaInfo 映射为 CaptchaTask
   * - taskId 由本地生成 UUID
   * - containerId 等于 taskId
   */
  private mapToTask(info: CaptchaInfo): CaptchaTask {
    // 判断是 V3 还是 V4
    const isV4 = !!info.geetestId;
    const provider = info.provider || (isV4 ? "geetest_v4" : "geetest_v3");

    // 映射类型：riskType -> type
    let type: CaptchaType = "word";
    if (info.riskType) {
      if (info.riskType.includes("icon")) {
        type = "icon";
      } else if (info.riskType.includes("word")) {
        type = "word";
      } else if (info.riskType.includes("slide")) {
        type = "slide";
      }
    }
    logger.info("映射验证码类型", { riskType: info.riskType, mappedType: type });

    // 本地生成 UUID 作为 taskId，containerId 等于 taskId
    const taskId = crypto.randomUUID();

    return {
      taskId,
      containerId: taskId, // containerId 等于 taskId
      challenge: info.challenge,
      geetestId: info.geetestId || info.gt,
      gt: info.gt,
      riskType: info.riskType,
      provider,
      type,
      created: info.created,
      createdAt: info.created,
    };
  }

  /**
   * 提交验证码结果
   * POST /captcha/resp
   *
   * 根据 provider 类型提交不同格式的验证结果
   */
  async submitResult(
    request: SubmitResultRequest,
  ): Promise<SubmitResultResponse> {
    // 只有成功时才需要提交到上游
    if (request.status !== "success" || !request.result) {
      logger.info("跳过非成功结果的上游提交", { status: request.status });
      return { success: true, message: "非成功结果，跳过上游提交" };
    }

    try {
      const body = this.buildSubmitBody(request);

      const response = await this.client.post<UpstreamApiResponse<null>>(
        "/captcha/resp",
        body,
      );

      const { code, message } = response.data;

      return {
        success: code === 1,
        message,
      };
    } catch (error) {
      logger.error("提交结果失败:", error);
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  /**
   * 构建提交请求体
   */
  private buildSubmitBody(
    request: SubmitResultRequest,
  ): SubmitV4ResultBody | SubmitV3ResultBody {
    const { challenge, result, provider } = request;

    if (provider === "geetest_v4") {
      return {
        challenge: challenge!,
        lot_number: result!.lot_number!,
        pass_token: result!.pass_token!,
        gen_time: result!.gen_time!,
        captcha_output: result!.captcha_output!,
      } as SubmitV4ResultBody;
    } else {
      // V3 格式
      return {
        challenge: challenge!,
        geetest_challenge: result!.geetest_challenge!,
        geetest_validate: result!.geetest_validate!,
        geetest_seccode: result!.geetest_seccode!,
      } as SubmitV3ResultBody;
    }
  }

  // ============ 统计查询 ============
  // 注意：统计相关 API 使用 /api 前缀，与上游 captcha API 不同

  /**
   * 获取总览统计
   * GET /api/stats?view=overview
   */
  async getOverviewStats(
    from?: number,
    to?: number,
  ): Promise<StatsResponse<OverviewStats>> {
    return this.getStats<OverviewStats>({ view: "overview", from, to });
  }

  /**
   * 获取按类型统计
   * GET /api/stats?view=by-type
   */
  async getStatsByType(
    from?: number,
    to?: number,
  ): Promise<StatsResponse<TypeStats[]>> {
    return this.getStats<TypeStats[]>({ view: "by-type", from, to });
  }

  /**
   * 获取按识别器统计
   * GET /api/stats?view=by-recognizer
   */
  async getStatsByRecognizer(
    from?: number,
    to?: number,
  ): Promise<StatsResponse<RecognizerStats[]>> {
    return this.getStats<RecognizerStats[]>({
      view: "by-recognizer",
      from,
      to,
    });
  }

  /**
   * 获取时间趋势统计
   * GET /api/stats?view=trend&interval={interval}
   */
  async getTrendStats(
    interval: StatsInterval = "hour",
    from?: number,
    to?: number,
  ): Promise<StatsResponse<TrendStats[]>> {
    return this.getStats<TrendStats[]>({ view: "trend", interval, from, to });
  }

  /**
   * 通用统计查询
   * GET /api/stats
   */
  async getStats<T>(params: StatsQueryParams): Promise<StatsResponse<T>> {
    try {
      const response = await axios.get<StatsResponse<T>>(
        `${this.baseUrl}/api/stats`,
        {
          params,
        },
      );
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
  async healthCheck(): Promise<
    ApiResponse<{ status: string; timestamp: string }>
  > {
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
    this.client.defaults.baseURL = baseUrl;
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
      const serverMessage = error.response?.data?.message;
      if (serverMessage) return serverMessage;

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

// 导出类型供外部使用
export type { SubmitV3ResultBody, SubmitV4ResultBody };
