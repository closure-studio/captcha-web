import { createModuleLogger } from "../../utils/logger";
import axios from "axios";

const logger = createModuleLogger("GeeTest Adapter");

// API 基础 URL
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const GeeTestAPIPaths = {
  V4: {
    register: "/api/geetest/v4/register",
    validate: "/api/geetest/v4/validate",
  },
};

// ============ Types ============

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

export interface GeeTestValidateResult {
  lot_number: string;
  captcha_output: string;
  pass_token: string;
  gen_time: string;
}

export interface GeeTestValidateResponse {
  result: string;
  msg: string;
}

export interface GeeTestElements {
  holder: HTMLElement | null;
  boxWrap: HTMLElement | null;
  sliderContainer: HTMLElement | null;
  sliderBtn: HTMLElement | null;
  sliderTrack: HTMLElement | null;
  sliceElement: HTMLElement | null;
  captchaWindow: HTMLElement | null;
  geeTestBox: HTMLElement | null;
}

// ============ Server API ============

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

// ============ DOM Operations ============

/**
 * 在容器内查找 GeeTest 元素
 */
export function findGeeTestElements(container: HTMLElement): GeeTestElements {
  const holder = container.querySelector<HTMLElement>(
    'div[class*="geetest_holder"]',
  );

  const boxWrap = holder?.querySelector<HTMLElement>(
    'div[class*="geetest_box_wrap"]',
  );

  let geeTestBox = document.querySelector<HTMLElement>(
    'div.geetest_box:not([class*="geetest_box_wrap"]):not([class*="geetest_captcha"])',
  );

  if (!geeTestBox) {
    const allElements = document.querySelectorAll<HTMLElement>(
      'div[class*="geetest_box"]',
    );
    for (const el of allElements) {
      const classList = el.className.split(" ");
      const hasGeeTestBox = classList.some(
        (cls) =>
          cls === "geetest_box" ||
          (cls.startsWith("geetest_box_") &&
            !cls.includes("wrap") &&
            !cls.includes("Show")),
      );
      const isNotWrapper = !classList.some(
        (cls) =>
          cls.includes("geetest_box_wrap") ||
          cls.includes("geetest_captcha") ||
          cls.includes("geetest_boxShow"),
      );
      if (hasGeeTestBox && isNotWrapper) {
        geeTestBox = el;
        break;
      }
    }
  }

  if (!geeTestBox && boxWrap) {
    geeTestBox = boxWrap.querySelector<HTMLElement>(
      'div[class*="geetest_box"]:not([class*="geetest_box_wrap"])',
    );
  }

  const sliderContainer = geeTestBox?.querySelector<HTMLElement>(
    'div[class*="geetest_slider"]',
  );
  const sliderBtn = sliderContainer?.querySelector<HTMLElement>(
    'div[class*="geetest_btn"]',
  );
  const sliderTrack = sliderContainer?.querySelector<HTMLElement>(
    'div[class*="geetest_track"]',
  );

  const sliceElement = geeTestBox?.querySelector<HTMLElement>(
    'div[class*="geetest_slice"]',
  );

  const captchaWindow = geeTestBox?.querySelector<HTMLElement>(
    'div[class*="geetest_window"]',
  );

  return {
    holder: holder ?? null,
    boxWrap: boxWrap ?? null,
    sliderContainer: sliderContainer ?? null,
    sliderBtn: sliderBtn ?? null,
    sliderTrack: sliderTrack ?? null,
    sliceElement: sliceElement ?? null,
    captchaWindow: captchaWindow ?? null,
    geeTestBox: geeTestBox ?? null,
  };
}

/**
 * 自动点击 GeeTest 按钮显示验证码
 */
export function autoClickCaptchaButton(container: HTMLElement): void {
  const button =
    container.querySelector(".geetest_btn_click") ||
    container.querySelector('[class*="geetest_btn_click"]') ||
    container.querySelector(".geetest_btn") ||
    container.querySelector('[class*="geetest"]');

  if (button && button instanceof HTMLElement) {
    logger.log("Auto clicking GeeTest button:", button.className);

    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: centerX,
      clientY: centerY,
    };

    button.dispatchEvent(new MouseEvent("mouseenter", eventOptions));
    button.dispatchEvent(new MouseEvent("mouseover", eventOptions));
    button.dispatchEvent(
      new MouseEvent("mousedown", { ...eventOptions, button: 0 }),
    );
    button.dispatchEvent(
      new MouseEvent("mouseup", { ...eventOptions, button: 0 }),
    );
    button.dispatchEvent(
      new MouseEvent("click", { ...eventOptions, button: 0 }),
    );

    button.focus();
    button.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
      }),
    );
    button.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        bubbles: true,
      }),
    );
  }
}
