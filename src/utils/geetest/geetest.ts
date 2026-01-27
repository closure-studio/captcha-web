import { GEETEST4_JS_URL } from "../../consts/consts";
import { createModuleLogger } from "../logger";

const logger = createModuleLogger("GeeTest");

/**
 * 动态加载 GeeTest v4 SDK
 */
export function loadGeeTestV4Script(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.initGeetest4 === "function") {
      resolve();
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${GEETEST4_JS_URL}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load GeeTest v4 SDK")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GEETEST4_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load GeeTest v4 SDK"));
    document.head.appendChild(script);
  });
}

/**
 * 在容器内查找 GeeTest 元素
 * 支持容器隔离，只在指定容器内搜索元素
 */
export function findGeeTestElements(container: HTMLElement) {
  // 查找 geetest_holder 作为基础容器
  const holder = container.querySelector<HTMLElement>(
    'div[class*="geetest_holder"]',
  );

  // 查找 geetest_box_wrap（验证码弹窗包装器）
  // 结构: geetest_holder > geetest_box_wrap > geetest_box
  const boxWrap = holder?.querySelector<HTMLElement>(
    'div[class*="geetest_box_wrap"]',
  );

  // 直接从 document 查找 geetest_box（完整的验证码弹窗）
  // GeeTest v4 使用 CSS Modules 生成类名，如 "geetest_box_7afe4570 geetest_box"
  // 使用更精确的选择器：
  // 1. 类名必须包含 "geetest_box"
  // 2. 排除 geetest_box_wrap（包装器）
  // 3. 排除 geetest_captcha（外层容器）
  // 4. 排除 geetest_boxShow（状态类）
  let geeTestBox = document.querySelector<HTMLElement>(
    'div.geetest_box:not([class*="geetest_box_wrap"]):not([class*="geetest_captcha"])',
  );

  // 如果精确选择器没找到，尝试使用属性选择器
  if (!geeTestBox) {
    // 查找类名以 "geetest_box_" 开头且同时有 "geetest_box" 类的元素
    // 这是 CSS Modules 生成的类名格式
    const allElements = document.querySelectorAll<HTMLElement>(
      'div[class*="geetest_box"]',
    );
    for (const el of allElements) {
      const classList = el.className.split(" ");
      // 检查是否有独立的 "geetest_box" 类（不是 geetest_box_wrap, geetest_captcha 等）
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

  // 如果还是没找到，尝试从 boxWrap 内部查找
  if (!geeTestBox && boxWrap) {
    geeTestBox = boxWrap.querySelector<HTMLElement>(
      'div[class*="geetest_box"]:not([class*="geetest_box_wrap"])',
    );
  }

  // 查找滑块容器和滑块按钮元素（在 geetest_box 内部）
  const sliderContainer = geeTestBox?.querySelector<HTMLElement>(
    'div[class*="geetest_slider"]',
  );
  const sliderBtn = sliderContainer?.querySelector<HTMLElement>(
    'div[class*="geetest_btn"]',
  );
  const sliderTrack = sliderContainer?.querySelector<HTMLElement>(
    'div[class*="geetest_track"]',
  );

  // 查找拼图块元素 (geetest_slice)
  const sliceElement = geeTestBox?.querySelector<HTMLElement>(
    'div[class*="geetest_slice"]',
  );

  // 查找验证码图片容器 (geetest_window)
  const captchaWindow = geeTestBox?.querySelector<HTMLElement>(
    'div[class*="geetest_window"]',
  );

  return {
    holder,
    boxWrap,
    sliderContainer,
    sliderBtn,
    sliderTrack,
    sliceElement,
    captchaWindow,
    geeTestBox,
  };
}

/**
 * 自动点击 GeeTest 按钮显示验证码
 */
export function autoClickCaptchaButton(container: HTMLElement): void {
  // 查找 GeeTest v4 的按钮
  const button =
    container.querySelector(".geetest_btn_click") ||
    container.querySelector('[class*="geetest_btn_click"]') ||
    container.querySelector(".geetest_btn") ||
    container.querySelector('[class*="geetest"]');

  if (button && button instanceof HTMLElement) {
    logger.log("Auto clicking GeeTest button:", button.className);

    // 模拟完整的鼠标事件序列
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

    // 触发鼠标事件序列
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

    // 也尝试触发 focus 和 keydown (Enter) 作为备选
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
