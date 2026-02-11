import axios, { type AxiosInstance } from "axios";
import type {
  ApiResponse,
  CaptchaTask,
  CaptchaType,
  FetchTasksResponse,
  SubmitResultRequest,
  SubmitResultResponse,
} from "../../types/api";
import { createModuleLogger } from "../logger";
import { CAPTCHA_SERVER_HOST } from "../../consts/consts";

const logger = createModuleLogger("CaptchaServerApi");

// 上游 API 响应格式
interface UpstreamApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// 上游返回的任务数据结构
interface ServerTaskItem {
  account: string;
  challenge: string;
  gt: string;
  geetestId: string;
  riskType: string;
  created: number;
  captcha_type: string;
}

// 提交 V4 结果请求体
interface SubmitV4ResultBody {
  account: string;
  challenge: string;
  lot_number: string;
  pass_token: string;
  gen_time: string;
  captcha_output: string;
}

// 提交 V3 结果请求体
interface SubmitV3ResultBody {
  account: string;
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
        UpstreamApiResponse<ServerTaskItem[]>
      >("/captcha/reqs", { params: { limit } });

      const { data, message } = response.data;

      if (!data || !Array.isArray(data)) {
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
  private mapToTask(info: ServerTaskItem): CaptchaTask {
    // 判断是 V3 还是 V4
    const isV4 = !!info.geetestId;
    const provider = isV4 ? "geetest_v4" : "geetest_v3";

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
    logger.info("映射验证码类型", {
      riskType: info.riskType,
      mappedType: type,
    });

    // 本地生成 UUID 作为 taskId，containerId 等于 taskId
    const taskId = crypto.randomUUID();
    const task: CaptchaTask = {
      taskId,
      account: info.account,
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
    if (task.gt === "f23ae14ba3a5bd01d1d65288422dbf97") {
      task.type = "slide";
    }
    return task;
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

      const { message } = response.data;

      return {
        success: true,
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
    const { challenge, result, provider, account } = request;

    if (provider === "geetest_v4") {
      return {
        account: account!,
        challenge: challenge!,
        lot_number: result!.lot_number!,
        pass_token: result!.pass_token!,
        gen_time: result!.gen_time!,
        captcha_output: result!.captcha_output!,
      } as SubmitV4ResultBody;
    } else {
      // V3 格式
      return {
        account: account!,
        challenge: challenge!,
        geetest_challenge: result!.geetest_challenge!,
        geetest_validate: result!.geetest_validate!,
        geetest_seccode: result!.geetest_seccode!,
      } as SubmitV3ResultBody;
    }
  }

  /**
   * 提交详细任务结果
   * POST /api/tasks/{taskId}
   *
   * 包含识别记录、Bypass 记录和资产信息
   */
  async submitTaskDetailed(
    request: SubmitResultRequest,
  ): Promise<SubmitResultResponse> {
    try {
      const { taskId, ...body } = request;

      const response = await this.client.post<SubmitResultResponse>(
        `/api/tasks/${taskId}`,
        body,
      );

      return response.data;
    } catch (error) {
      logger.error("提交详细任务结果失败:", error);
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
