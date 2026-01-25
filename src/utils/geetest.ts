import axios from "axios";

// GeeTest v4 响应数据类型
export interface GeeTestRegisterData {
  lot_number: string;
  captcha_type: string;
  slice: string;
  bg: string;
  ypos: number;
  arrow: string;
  js: string;
  css: string;
  static_path: string;
  gct_path: string;
  show_voice: boolean;
  feedback: string;
}

export interface GeeTestRegisterResponse {
  status: string;
  data: GeeTestRegisterData;
}

// GeeTest 验证结果类型
export interface GeeTestValidateResult {
  lot_number: string;
  captcha_output: string;
  pass_token: string;
  gen_time: string;
}

// 服务器验证响应类型
export interface GeeTestValidateResponse {
  result: string;
  msg: string;
}

const GeeTestAPIPaths = {
  V4: {
    register: "/api/geetest/v4/register",
    validate: "/api/geetest/v4/validate",
  },
};

// API 基础 URL
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

/**
 * 获取 GeeTest v4 注册数据
 */
export async function getGeeTestRegister(): Promise<GeeTestRegisterResponse> {
  const response = await axios.get<GeeTestRegisterResponse>(
    `${API_BASE_URL}${GeeTestAPIPaths.V4.register}`,
  );
  return response.data;
}

/**
 * 验证 GeeTest captcha
 */
export async function validateGeeTest(
  result: GeeTestValidateResult,
): Promise<GeeTestValidateResponse> {
  const response = await axios.post<GeeTestValidateResponse>(
    `${API_BASE_URL}${GeeTestAPIPaths.V4.validate}`,
    result,
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
}
