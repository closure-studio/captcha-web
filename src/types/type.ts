export interface CaptchaInfo {
  containerId: string;
  challenge: string;
  geetestId?: string;
  riskType?: string;
  provider: "geetest_v4" | "geetest_v3";
  type?: "slide" | "word" | "icon";
}
