export interface CaptchaInfo {
  challenge: string;
  geetestId?: string; // Geetest V4 ID
  gt?: string; // Geetest V3 ID
  riskType?: string;
  provider: "geetest_v4" | "geetest_v3";
  type?: "slide" | "word" | "icon";
  created?: number; // 上游创建时间戳
  captcha_type?: string; // 上游验证码类型字段
}
