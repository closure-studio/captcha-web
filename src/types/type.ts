import type { CaptchaType } from "./api";

export interface CaptchaInfo {
  challenge: string;
  geetestId?: string; // Geetest V4 ID
  gt?: string; // Geetest V3 ID
  riskType?: string;
  provider: "geetest_v4" | "geetest_v3";
  type: CaptchaType;
  created?: number; // 上游创建时间戳
}
