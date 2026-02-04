import axios from "axios";
import { createModuleLogger } from "../../../utils/logger";

const logger = createModuleLogger("TTShitu Client");

// TTShitu API 基础 URL
const TTSHITU_API_URL = "http://api.ttshitu.com";

// TTShitu 账号信息
const TTSHITU_USERNAME = "";
const TTSHITU_PASSWORD = "";

/**
 * TTShitu 验证码类型
 */
export const TTShituTypeId = {
  /** 纯数字 */
  PURE_NUMBER: "1",
  /** 纯数字2 */
  PURE_NUMBER_2: "1001",
  /** 纯英文 */
  PURE_ENGLISH: "2",
  /** 纯英文2 */
  PURE_ENGLISH_2: "1002",
  /** 数英混合 */
  ALPHANUMERIC: "3",
  /** 数英混合2 */
  ALPHANUMERIC_2: "1003",
  /** 闪动GIF */
  FLASH_GIF: "4",
  /** 无感学习(独家) */
  SENSELESS_LEARNING: "7",
  /** 问答题 */
  QA: "66",
  /** 计算题 */
  CALCULATION: "11",
  /** 快速计算题 */
  FAST_CALCULATION: "1005",
  /** 快速计算题2 */
  FAST_CALCULATION_2: "5",
  /** 汉字 */
  CHINESE: "16",
  /** 通用文字识别(证件、单据) */
  OCR: "32",
  /** 旋转类型 */
  ROTATION: "29",
  /** 背景匹配旋转类型 */
  BACKGROUND_ROTATION: "1029",
  /** 背景匹配双旋转类型 */
  BACKGROUND_DOUBLE_ROTATION: "2029",
  /** 点选1个坐标 */
  CLICK_1: "19",
  /** 点选3个坐标 */
  CLICK_3: "20",
  /** 点选3~5个坐标 */
  CLICK_3_5: "21",
  /** 点选5~8个坐标 */
  CLICK_5_8: "22",
  /** 点选1~4个坐标 */
  CLICK_1_4: "27",
  /** 轨迹类型 */
  TRACK: "48",
  /** 缺口识别（需要2张图） */
  GAP_DUAL: "18",
  /** 单缺口识别（返回X轴坐标，只需要1张图） */
  GAP_SINGLE_X: "33",
  /** 缺口识别2（返回X轴坐标，只需要1张图） */
  GAP_SINGLE_X_2: "34",
  /** 缺口识别（返回缺口左上角X,Y坐标，只需要1张图） */
  GAP_SINGLE_XY: "3400",
  /** 拖动拼图 */
  DRAG_PUZZLE: "1033",
  /** 拼图识别 */
  PUZZLE: "53",
} as const;

export type TTShituTypeIdValue =
  (typeof TTShituTypeId)[keyof typeof TTShituTypeId];

/**
 * TTShitu 请求参数
 */
export interface TTShituPredictRequest {
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 验证码类型ID */
  typeid?: string;
  /** Base64 编码的图片（不含 data:image/...;base64, 前缀） */
  image: string;
  /** 旋转角度（当 typeid 为 14 时） */
  angle?: string;
  /** 每次旋转的角度（当 typeid 为旋转类型时），默认 10 */
  step?: string;
  /** 无感学习子类型名称（当 typeid 为 7 时） */
  typename?: string;
  /** 备注字段 */
  remark?: string;
  /** 背景图（缺口识别2张图时需要） */
  imageback?: string;
  /** 标题内容（快速点选需要） */
  content?: string;
  /** 标题图片（快速点选需要） */
  title_image?: string;
}

/**
 * TTShitu 响应数据
 */
export interface TTShituPredictResponse {
  /** 请求返回的状态 */
  success: boolean;
  /** 返回的code，成功为0，失败为-1 */
  code: string;
  /** 失败原因 */
  message: string;
  /** 成功返回的结果内容 */
  data:
    | {
        /** 识别结果 */
        result: string;
        /** 识别结果ID，用于报错 */
        id: string;
      }
    | string;
}

/**
 * TTShitu 报错接口响应数据
 */
export interface TTShituReportErrorResponse {
  /** 请求返回的状态，true成功，false失败 */
  success: boolean;
  /** 返回的code，成功为0，失败为-1 */
  code: string;
  /** 失败原因（success=false时返回的原因） */
  message: string;
  /** 结果载体 */
  data:
    | {
        /** 报错结果 */
        result: string;
      }
    | string;
}

/**
 * TTShitu 客户端选项
 */
export interface TTShituOptions {
  username?: string;
  password?: string;
  baseUrl?: string;
}

/**
 * TTShitu API 客户端
 */
export class TTShituClient {
  private username: string;
  private password: string;
  private baseUrl: string;

  constructor(options: TTShituOptions = {}) {
    this.username = options.username || TTSHITU_USERNAME;
    this.password = options.password || TTSHITU_PASSWORD;
    this.baseUrl = options.baseUrl || TTSHITU_API_URL;

    if (!this.username || !this.password) {
      logger.warn(
        "TTShitu username/password not provided. Set VITE_TTSHITU_USERNAME and VITE_TTSHITU_PASSWORD environment variables or pass in options.",
      );
    }
  }

  /**
   * 识别验证码
   * @param image Base64 编码的图片（不含 data:image/...;base64, 前缀）
   * @param typeid 验证码类型ID，默认为 33（单缺口识别）
   * @param options 其他可选参数
   * @returns 识别结果
   */
  async predict(
    image: string,
    typeid: string = TTShituTypeId.GAP_SINGLE_X,
    options?: Partial<TTShituPredictRequest>,
  ): Promise<{ result: string; id: string }> {
    const requestBody: TTShituPredictRequest = {
      username: this.username,
      password: this.password,
      typeid,
      image,
      ...options,
    };

    const response = await axios.post<TTShituPredictResponse>(
      `${this.baseUrl}/predict`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
        },
        timeout: 60000, // 设置60秒超时
      },
    );

    if (!response.data.success) {
      throw new Error(`TTShitu predict error: ${response.data.message}`);
    }

    if (typeof response.data.data === "string") {
      throw new Error("TTShitu predict error: Invalid response data");
    }

    return response.data.data;
  }

  /**
   * 单缺口识别（返回X轴坐标，只需要1张图）
   * @param image Base64 编码的图片
   * @returns X轴坐标
   */
  async recognizeGapX(image: string): Promise<number> {
    const result = await this.predict(image, TTShituTypeId.GAP_SINGLE_X);
    const x = parseInt(result.result, 10);
    if (isNaN(x)) {
      throw new Error(
        `TTShitu recognizeGapX error: Invalid result "${result.result}"`,
      );
    }
    return x;
  }

  /**
   * 缺口识别2（返回X轴坐标，只需要1张图）
   * @param image Base64 编码的图片
   * @returns X轴坐标
   */
  async recognizeGapX2(image: string): Promise<number> {
    const result = await this.predict(image, TTShituTypeId.GAP_SINGLE_X_2);
    const x = parseInt(result.result, 10);
    if (isNaN(x)) {
      throw new Error(
        `TTShitu recognizeGapX2 error: Invalid result "${result.result}"`,
      );
    }
    return x;
  }

  /**
   * 缺口识别（返回缺口左上角X,Y坐标，只需要1张图）
   * @param image Base64 编码的图片
   * @returns {x, y} 坐标
   */
  async recognizeGapXY(image: string): Promise<{ x: number; y: number }> {
    const result = await this.predict(image, TTShituTypeId.GAP_SINGLE_XY);
    const coords = result.result.split(",");
    const x = parseInt(coords[0], 10);
    const y = parseInt(coords[1], 10);
    if (isNaN(x) || isNaN(y)) {
      throw new Error(
        `TTShitu recognizeGapXY error: Invalid result "${result.result}"`,
      );
    }
    return { x, y };
  }

  /**
   * 缺口识别（需要2张图：目标图和缺口图）
   * @param image 目标图 Base64
   * @param imageback 缺口图 Base64
   * @returns 识别结果
   */
  async recognizeGapDual(image: string, imageback: string): Promise<string> {
    const result = await this.predict(image, TTShituTypeId.GAP_DUAL, {
      imageback,
    });
    return result.result;
  }

  /**
   * 报错接口 - 识别错误时调用此接口报错
   * 注：为了保障接口使用的流畅性，报错结果在5min后批量更新，并返还次数或金额
   * @param id 识别成功返回的id
   * @returns 报错结果
   */
  async reportError(id: string): Promise<{ result: string }> {
    const response = await axios.post<TTShituReportErrorResponse>(
      `${this.baseUrl}/reporterror.json`,
      { id },
      {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
        },
        timeout: 30000, // 设置30秒超时
      },
    );

    if (!response.data.success) {
      throw new Error(`TTShitu reportError error: ${response.data.message}`);
    }

    // 服务端可能返回字符串或对象格式，需要兼容两种情况
    // 成功时可能返回: data: "报错成功" 或 data: { result: "报错成功" }
    if (typeof response.data.data === "string") {
      return { result: response.data.data };
    }

    return response.data.data;
  }
}

// 默认客户端实例
let defaultClient: TTShituClient | null = null;

/**
 * 获取默认客户端实例
 */
export function getDefaultTTShituClient(): TTShituClient {
  if (!defaultClient) {
    defaultClient = new TTShituClient();
  }
  return defaultClient;
}

/**
 * 识别验证码（使用默认客户端）
 */
export async function predictTTShitu(
  image: string,
  typeid: string = TTShituTypeId.GAP_SINGLE_X,
  options?: Partial<TTShituPredictRequest>,
): Promise<{ result: string; id: string }> {
  return getDefaultTTShituClient().predict(image, typeid, options);
}

/**
 * 单缺口识别（使用默认客户端）
 */
export async function recognizeGapX(image: string): Promise<number> {
  return getDefaultTTShituClient().recognizeGapX(image);
}

/**
 * 缺口识别2（使用默认客户端）
 */
export async function recognizeGapX2(image: string): Promise<number> {
  return getDefaultTTShituClient().recognizeGapX2(image);
}

/**
 * 缺口识别XY（使用默认客户端）
 */
export async function recognizeGapXY(
  image: string,
): Promise<{ x: number; y: number }> {
  return getDefaultTTShituClient().recognizeGapXY(image);
}

/**
 * 报错接口（使用默认客户端）
 * 注：为了保障接口使用的流畅性，报错结果在5min后批量更新，并返还次数或金额
 * @param id 识别成功返回的id
 * @returns 报错结果
 */
export async function reportErrorTTShitu(
  id: string,
): Promise<{ result: string }> {
  return getDefaultTTShituClient().reportError(id);
}
