// ============ GeeTest SDK ============

export const GEETEST4_JS_URL = "https://static.geetest.com/v4/gt4.js";
export const GEETEST3_JS_URL = "https://static.geetest.com/static/js/gt.0.5.0.js";

// ============ API ============

export const CAPTCHA_SERVER_HOST =
  (import.meta.env.VITE_CAPTCHA_SERVER_HOST as string) || "http://localhost:8787";

// ============ Third-party Services ============

export const TTSHITU_API_URL = "http://api.ttshitu.com";
export const AEGIR_API_URL = "https://captcha-aegir.dltest.workers.dev";

// ============ Queue ============

export const TASK_QUEUE_LENGTH = 8;

// ============ Timing (ms) ============

/** 自动刷新间隔 - 16 小时 */
export const AUTO_REFRESH_INTERVAL = 16 * 60 * 60 * 1000;
/** 等待任务完成的最大时间 - 5 分钟 */
export const MAX_WAIT_TIME = 5 * 60 * 1000;
/** 等待任务完成的检查间隔 */
export const WAIT_CHECK_INTERVAL = 1000;

// ============ Limits ============

/** Provider 统计最大记录数，超过后重置 */
export const MAX_COUNT_PER_PROVIDER = 10000;

// ============ Crop Defaults ============

export const DEFAULT_SLIDE_CROP = { topCrop: 10, bottomCrop: 110 };
export const DEFAULT_CLICK_CROP = { topCrop: 30, bottomCrop: 125 };
