// GeeTest related constants
export const CAPTCHA_ID =
  import.meta.env.VITE_GEETEST_CAPTCHA_ID || "your-captcha-id";

// GeeTest v4 CDN URL
export const GEETEST4_JS_URL = "https://static.geetest.com/v4/gt4.js";

// Re-export captcha constants
export * from "./captcha";
