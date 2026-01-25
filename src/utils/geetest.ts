import axios from 'axios';

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

// API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * 获取 GeeTest v4 注册数据
 */
export async function getGeeTestRegister(): Promise<GeeTestRegisterResponse> {
  const response = await axios.get<GeeTestRegisterResponse>(
    `${API_BASE_URL}/api/geetest/register`
  );
  return response.data;
}

/**
 * 验证 GeeTest captcha（可选，根据后端实现）
 */
export async function validateGeeTest(
  result: GeeTestValidateResult
): Promise<{ status: string; message: string }> {
  const response = await axios.post(`${API_BASE_URL}/api/geetest/validate`, result);
  return response.data;
}
