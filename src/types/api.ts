import type { CaptchaInfo } from "./type";

// 从服务器获取的任务
export interface CaptchaTask extends CaptchaInfo {
  taskId: string; // 服务器分配的任务ID
  createdAt?: number; // 任务创建时间戳
  priority?: number; // 优先级
}

// 获取任务列表的响应
export interface FetchTasksResponse {
  success: boolean;
  data: CaptchaTask[];
  message?: string;
}

// 验证结果状态
export type CaptchaResultStatus = "success" | "failed" | "timeout" | "error";

// 上传验证结果的请求
export interface SubmitResultRequest {
  taskId: string;
  containerId: string;
  status: CaptchaResultStatus;
  result?: {
    lot_number?: string;
    captcha_output?: string;
    pass_token?: string;
    gen_time?: string;
  };
  errorMessage?: string;
  duration?: number; // 耗时（毫秒）
}

// 上传验证结果的响应
export interface SubmitResultResponse {
  success: boolean;
  message?: string;
}

// API配置
export interface CaptchaApiConfig {
  baseUrl: string;
  pollInterval?: number; // 轮询间隔（毫秒）
  maxConcurrent?: number; // 最大并发数
  useMock?: boolean; // 是否使用mock数据
}
