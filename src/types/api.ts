import type { CaptchaInfo } from "./type";

// ============ 基础类型 ============

// 任务状态
export type TaskStatus = "pending" | "success" | "failed" | "timeout" | "error";

// 验证码类型
export type CaptchaType = "slide" | "word" | "icon";

// Provider
export type Provider = "geetest_v4" | "geetest_v3";

// 识别器名称
export type RecognizerName = "TTShitu" | "Gemini" | "Aegir" | "Cloudflare" | "Nvidia";

// Bypass 类型
export type BypassType = "slide" | "click";

// 资产类型
export type AssetType = "original" | "cropped" | "marked" | "background";

// 坐标点
export interface Point {
  x: number;
  y: number;
}

// ============ 任务相关 ============

// 从服务器获取的任务
export interface CaptchaTask extends CaptchaInfo {
  taskId: string; // 服务器分配的任务ID
  createdAt?: number; // 任务创建时间戳
  completed?: boolean; // 本地标记：任务是否已完成
}

// 创建任务请求
export interface CreateTaskRequest {
  challenge: string;
  provider: Provider;
  geetestId?: string;
  captchaType?: CaptchaType;
  riskType?: string;
}

// 创建任务响应
export interface CreateTaskResponse {
  success: boolean;
  taskId?: string;
  message?: string;
  error?: string;
}

// 获取任务列表的响应
export interface FetchTasksResponse {
  success: boolean;
  data: CaptchaTask[];
  message?: string;
}

// ============ 识别记录 ============

export interface RecognitionRecord {
  recognizerName: RecognizerName;
  success: boolean;
  attemptSeq?: number;
  captchaId?: string;
  points?: Point[];
  message?: string;
  elapsedMs?: number;
  errorReported?: boolean;
}

// ============ Bypass 记录 ============

export interface BypassRecord {
  bypassType: BypassType;
  success: boolean;
  message?: string;
  configJson?: string;
  targetX?: number;
  actualSteps?: number;
}

// ============ 资产记录 ============

export interface AssetRecord {
  assetType: AssetType;
  r2Key: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

// ============ 提交结果 ============

// 验证结果状态 (兼容旧类型)
export type CaptchaResultStatus = TaskStatus;

// GeeTest 验证成功凭证
export interface GeetestValidateResult {
  lot_number?: string;
  captcha_output?: string;
  pass_token?: string;
  gen_time?: string;
}

// 上传验证结果的请求
export interface SubmitResultRequest {
  taskId: string;
  containerId?: string; // 本地使用，不发送到服务器
  status: CaptchaResultStatus;
  result?: GeetestValidateResult;
  duration?: number;
  errorMessage?: string;
  recognition?: RecognitionRecord;
  recognitions?: RecognitionRecord[];
  bypass?: BypassRecord;
  assets?: AssetRecord[];

  // 任务原始信息（因为 fetchTasks 的任务不在 D1 中，需要完整传递）
  challenge?: string;
  geetestId?: string;
  provider?: Provider;
  captchaType?: CaptchaType;
  riskType?: string;
}

// 上传验证结果的响应
export interface SubmitResultResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ============ 统计相关 ============

// 统计视图类型
export type StatsView = "overview" | "by-type" | "by-recognizer" | "trend";

// 时间粒度
export type StatsInterval = "hour" | "day";

// 统计查询参数
export interface StatsQueryParams {
  view?: StatsView;
  from?: number;
  to?: number;
  interval?: StatsInterval;
}

// 总览统计
export interface OverviewStats {
  total: number;
  success: number;
  failed: number;
  timeout: number;
  error: number;
  successRate: number;
  avgDurationMs: number;
}

// 按类型统计
export interface TypeStats {
  captchaType: CaptchaType;
  total: number;
  success: number;
  successRate: number;
  avgDurationMs: number;
}

// 按识别器统计
export interface RecognizerStats {
  recognizerName: RecognizerName;
  total: number;
  success: number;
  successRate: number;
  avgElapsedMs: number;
}

// 时间趋势统计
export interface TrendStats {
  time: string;
  total: number;
  success: number;
  successRate: number;
}

// 统计响应
export interface StatsResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============ API 配置 ============

export interface CaptchaApiConfig {
  baseUrl: string;
  pollInterval?: number; // 轮询间隔（毫秒）
  maxConcurrent?: number; // 最大并发数
  useMock?: boolean; // 是否使用mock数据
}

// ============ 通用响应 ============

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
