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
  // 优先查找包含 geetest_widget 的 holder（V3 挑战面板），其次查找 geetest_embed，最后兜底
  const allHolders = container.querySelectorAll<HTMLElement>(
    'div[class*="geetest_holder"]',
  );
  let holder: HTMLElement | null = null;
  // V3: 雷达按钮和挑战面板都有 geetest_holder，优先选含 geetest_widget 的（挑战面板）
  for (let i = allHolders.length - 1; i >= 0; i--) {
    if (allHolders[i].querySelector('.geetest_widget')) {
      holder = allHolders[i];
      break;
    }
  }
  // 兜底：geetest_embed 或最后一个 holder
  if (!holder) {
    for (const h of allHolders) {
      if (h.className.includes("geetest_embed")) {
        holder = h;
        break;
      }
    }
  }
  if (!holder && allHolders.length > 0) {
    holder = allHolders[allHolders.length - 1];
  }

  const boxWrap = holder?.querySelector<HTMLElement>(
    'div[class*="geetest_box_wrap"]',
  );

  // 首先尝试在 container 内部查找 geetest_box (V4)
  let geeTestBox = container.querySelector<HTMLElement>(
    'div.geetest_box:not([class*="geetest_box_wrap"]):not([class*="geetest_captcha"])',
  );

  if (!geeTestBox) {
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

  if (!geeTestBox && holder) {
    if (boxWrap) {
      geeTestBox = boxWrap.querySelector<HTMLElement>(
        'div[class*="geetest_box"]:not([class*="geetest_box_wrap"])',
      );
    }
  }

  // V3 没有 geetest_box，所有元素在 holder 内
  const searchRoot = geeTestBox || holder;

  const sliderContainer = searchRoot?.querySelector<HTMLElement>(
    'div[class*="geetest_slider"]',
  );
  const sliderBtn =
    sliderContainer?.querySelector<HTMLElement>(
      'div[class*="geetest_slider_button"]',
    ) ||
    sliderContainer?.querySelector<HTMLElement>(
      'div[class*="geetest_btn"]',
    );
  const sliderTrack =
    sliderContainer?.querySelector<HTMLElement>(
      'div[class*="geetest_slider_track"]',
    ) ||
    sliderContainer?.querySelector<HTMLElement>(
      'div[class*="geetest_track"]',
    );

  const sliceElement =
    searchRoot?.querySelector<HTMLElement>(
      'div[class*="geetest_slice"]',
    ) ||
    searchRoot?.querySelector<HTMLElement>(
      'canvas[class*="geetest_canvas_slice"]',
    );

  const captchaWindow = searchRoot?.querySelector<HTMLElement>(
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
