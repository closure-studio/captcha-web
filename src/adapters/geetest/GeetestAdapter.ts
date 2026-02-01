import { createModuleLogger } from "../../utils/logger";

const logger = createModuleLogger("GeeTest Adapter");

// ============ Types ============

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

// ============ DOM Operations ============

/**
 * 判断一个元素是否是 geetest_box（而非 wrapper）
 */
function isGeeTestBox(el: HTMLElement): boolean {
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
  return hasGeeTestBox && isNotWrapper;
}

/**
 * 在容器内查找 GeeTest 元素
 * 注意：GeeTest SDK 可能会将 geetest_box 挂载到 body 而非 container 内
 * 我们需要通过 holder 中的某些标识来关联正确的 geetest_box
 */
export function findGeeTestElements(container: HTMLElement): GeeTestElements {
  const holder = container.querySelector<HTMLElement>(
    'div[class*="geetest_holder"]',
  );

  const boxWrap = holder?.querySelector<HTMLElement>(
    'div[class*="geetest_box_wrap"]',
  );

  // 首先尝试在 container 内部查找 geetest_box
  let geeTestBox = container.querySelector<HTMLElement>(
    'div.geetest_box:not([class*="geetest_box_wrap"]):not([class*="geetest_captcha"])',
  );

  if (!geeTestBox) {
    // 在 container 内查找
    const containerElements = container.querySelectorAll<HTMLElement>(
      'div[class*="geetest_box"]',
    );
    for (const el of containerElements) {
      if (isGeeTestBox(el)) {
        geeTestBox = el;
        break;
      }
    }
  }

  // 如果 container 内找不到，可能是 GeeTest SDK 将其挂载到了 body
  // 尝试通过 holder 的 ID 或其他关联方式查找
  if (!geeTestBox && holder) {
    // GeeTest 通常会给 holder 一个唯一的 class 或 ID，尝试查找关联的 box
    // 查找 holder 内的 boxWrap，然后找其中的 geetest_box
    if (boxWrap) {
      geeTestBox = boxWrap.querySelector<HTMLElement>(
        'div[class*="geetest_box"]:not([class*="geetest_box_wrap"])',
      );
    }
  }

  // 最后的 fallback：在全局查找，但只在没有其他选择时使用
  // 这种情况下多个验证码可能会冲突
  if (!geeTestBox) {
    logger.warn(
      "未在 container 内找到 geetest_box，尝试全局查找（可能导致多验证码冲突）",
    );
    const allElements = document.querySelectorAll<HTMLElement>(
      'div[class*="geetest_box"]',
    );
    for (const el of allElements) {
      if (isGeeTestBox(el)) {
        geeTestBox = el;
        break;
      }
    }
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
