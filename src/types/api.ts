// ============ 基础类型 ============

// 通用 API 响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 验证码类型
export type CaptchaType = "slide" | "word" | "icon";

// Provider
export type Provider = "geetest_v4" | "geetest_v3";

// 识别器名称
export type RecognizerName =
  | "TTShitu"
  | "Gemini"
  | "Aegir"
  | "Cloudflare"
  | "Nvidia";

// Bypass 类型
export type BypassType = "slide" | "click";

// 资产类型
export type AssetType = "original" | "cropped" | "marked" | "background";

// 坐标点
export interface Point {
  x: number;
  y: number;
}

// 图片裁剪配置
export interface ImageCropConfig {
  topCrop: number;
  bottomCrop: number;
}

// 识别 API 通用响应
export interface RecognitionResponse {
  success: boolean;
  elapsed?: number;
  data: Point[];
}

// 识别 API 客户端选项
export interface RecognitionClientOptions {
  baseUrl?: string;
}

// ============ 任务相关 ============

export interface CaptchaInfo {
  challenge: string;
  geetestId?: string; // Geetest V4 ID
  gt?: string; // Geetest V3 ID
  riskType?: string;
  provider: "geetest_v4" | "geetest_v3";
  type: CaptchaType;
  created?: number; // 上游创建时间戳
}

// 从服务器获取的任务（扩展 CaptchaInfo）
export interface CaptchaTask extends CaptchaInfo {
  taskId: string; // 本地生成的 UUID（服务器不返回 taskId）
  containerId: string; // 等于 taskId，用于 DOM 容器 ID
  createdAt?: number; // 任务创建时间戳（映射自上游 created 字段）
  completed?: boolean; // 本地标记：任务是否已完成
}

// 任务槽位类型：可以是任务或空槽位
export type TaskSlot = CaptchaTask | null;

// 固定长度的任务队列类型
export type TaskQueue = [
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
  TaskSlot,
];

// 获取任务列表的响应（使用统一的 ApiResponse 格式）
export type FetchTasksResponse = ApiResponse<CaptchaTask[]>;

// 上传验证结果的响应（使用统一的 ApiResponse 格式）
export type SubmitResultResponse = ApiResponse<null>;

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

// 验证结果状态
export type CaptchaResultStatus =
  | "pending"
  | "success"
  | "failed"
  | "timeout"
  | "error";

// GeeTest 验证成功凭证
export interface GeetestValidateResult {
  // V4 字段
  lot_number?: string;
  captcha_output?: string;
  pass_token?: string;
  gen_time?: string;
  // V3 字段
  geetest_challenge?: string;
  geetest_validate?: string;
  geetest_seccode?: string;
}

// 上传验证结果的请求
export interface SubmitResultRequest {
  taskId: string;
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

// ============ API 配置 ============

export interface CaptchaApiConfig {
  baseUrl: string;
  pollInterval?: number; // 轮询间隔（毫秒）
  maxConcurrent?: number; // 最大并发数
}
