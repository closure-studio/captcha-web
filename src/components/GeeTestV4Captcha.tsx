import { domToPng } from "modern-screenshot";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GeeTest4Config,
  GeeTest4Error,
  GeeTest4Instance,
} from "../types/geetest4.d.ts";
import type { CaptchaType } from "../types/type.ts";
import { validateGeeTest } from "../utils/geetest";
import type {
  CaptchaSolveResult,
  GeeTestSlideBypassContext,
  ICaptchaProvider,
} from "../utils/captcha/type/provider.ts";
import {
  CaptchaSolveCode,
  CaptchaType as ProviderCaptchaType,
} from "../utils/captcha/type/provider.ts";

// GeeTest v4 CDN URL
const GEETEST4_JS_URL = "https://static.geetest.com/v4/gt4.js";

export interface GeeTestV4CaptchaProps {
  /** 验证码类型配置 */
  captchaType: CaptchaType;
  /** 验证码提供者实例 */
  provider: ICaptchaProvider;
  /** 容器ID，用于隔离多个验证码实例 */
  containerId: string;
  /** 验证完成回调（包含服务器验证结果） */
  onComplete?: () => void;
}

/**
 * 动态加载 GeeTest v4 SDK
 */
function loadGeeTestV4Script(): Promise<void> {
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
function findGeeTestElements(container: HTMLElement) {
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
function autoClickCaptchaButton(container: HTMLElement): void {
  // 查找 GeeTest v4 的按钮
  const button =
    container.querySelector(".geetest_btn_click") ||
    container.querySelector('[class*="geetest_btn_click"]') ||
    container.querySelector(".geetest_btn") ||
    container.querySelector('[class*="geetest"]');

  if (button && button instanceof HTMLElement) {
    console.log("Auto clicking GeeTest button:", button.className);

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

/**
 * GeeTest v4 验证码组件
 * 支持 Provider 模式和容器隔离
 */
export function GeeTestV4Captcha(props: GeeTestV4CaptchaProps) {
  const { captchaType, provider, containerId, onComplete } = props;

  // 内部容器ID，用于 GeeTest appendTo
  const innerContainerId = useRef(
    `geetest-inner-${Math.random().toString(36).substring(2, 9)}`,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const captchaRef = useRef<GeeTest4Instance | null>(null);

  // 存储当前识别结果的 ID，用于报错
  const recognitionIdRef = useRef<string | null>(null);
  // 当前识别结果
  const solveResultRef = useRef<CaptchaSolveResult | null>(null);
  // 重试次数计数
  const retryCountRef = useRef<number>(0);
  // 最大重试次数
  const MAX_RETRY_COUNT = 5;

  // SDK 加载状态
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 验证状态
  const [status, setStatus] = useState<
    "idle" | "solving" | "validating" | "success" | "error" | "retrying"
  >("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");

  /**
   * 获取外部容器元素（用于隔离）
   */
  const getOuterContainer = useCallback((): HTMLElement | null => {
    return document.getElementById(containerId);
  }, [containerId]);

  /**
   * 截取整个 GeeTest 验证码盒子的截图
   * 直接对外部容器 (captcha-isolation-container) 进行截图
   */
  const captureGeeTestBox = useCallback(async (): Promise<{
    base64: string;
    canvas: HTMLCanvasElement;
  } | null> => {
    const outerContainer = getOuterContainer();
    if (!outerContainer) {
      console.error("未找到外部容器");
      return null;
    }

    console.log("截图目标元素:", outerContainer.className);
    console.log("截图元素尺寸:", {
      width: outerContainer.offsetWidth,
      height: outerContainer.offsetHeight,
    });

    // 直接对外部容器进行截图
    // 外部容器 (captcha-isolation-container) 包含完整的验证码
    const dataUrl = await domToPng(outerContainer, {
      quality: 1,
      scale: 1,
      backgroundColor: null,
      fetch: {
        requestInit: {
          mode: "cors",
        },
      },
    });

    if (!dataUrl) {
      console.error("modern-screenshot 截图失败: 返回空数据");
      return null;
    }

    const base64 = dataUrl.split(",")[1];

    // 创建 canvas 用于后续调试红线绘制
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0);
    }

    // 在控制台打印截图预览
    console.log("验证码截图成功 (使用 modern-screenshot)");
    console.log(
      "%c ",
      `
      font-size: 1px;
      padding: ${Math.min(canvas.height / 2, 150)}px ${Math.min(canvas.width / 2, 200)}px;
      background: url(${dataUrl}) no-repeat;
      background-size: contain;
    `,
    );

    return { base64, canvas };
  }, [getOuterContainer]);

  /**
   * 绘制调试红线
   */
  const drawDebugLine = useCallback(
    (canvas: HTMLCanvasElement, xPosition: number) => {
      // 创建新的 canvas 来绘制红线（调试用）
      const markedCanvas = document.createElement("canvas");
      markedCanvas.width = canvas.width;
      markedCanvas.height = canvas.height;
      const ctx = markedCanvas.getContext("2d");

      if (ctx) {
        // 先绘制原图
        ctx.drawImage(canvas, 0, 0);

        // 画红色竖线
        ctx.strokeStyle = "red";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(xPosition, 0);
        ctx.lineTo(xPosition, markedCanvas.height);
        ctx.stroke();

        // 添加坐标标注背景
        ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
        ctx.fillRect(xPosition + 5, 5, 60, 18);

        // 添加坐标标注文字
        ctx.fillStyle = "white";
        ctx.font = "bold 12px Arial";
        ctx.fillText(`X=${xPosition}`, xPosition + 10, 18);

        // 输出带红线的截图到控制台
        const markedDataUrl = markedCanvas.toDataURL("image/png");
        console.log(
          `${provider.name}: 识别结果可视化（红线为识别的X坐标位置）:`,
        );
        console.log(
          "%c ",
          `
        font-size: 1px;
        padding: ${canvas.height / 2}px ${canvas.width / 2}px;
        background: url(${markedDataUrl}) no-repeat;
        background-size: contain;
      `,
        );
      }
    },
    [provider.name],
  );

  /**
   * 使用 Provider 自动识别并执行 bypass
   */
  const autoSolveCaptcha = useCallback(async (): Promise<string> => {
    const outerContainer = getOuterContainer();
    if (!outerContainer) {
      throw new Error("未找到外部容器");
    }

    // 截取验证码截图
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const captureResult = await captureGeeTestBox();
    if (!captureResult) {
      throw new Error("截图失败");
    }

    const { base64, canvas } = captureResult;

    console.log(`${provider.name}: 开始识别验证码...`);

    // 调用 Provider 识别
    const solveResult = await provider.solve({
      image: base64,
      type: ProviderCaptchaType.SLIDE,
    });

    if (solveResult.code !== CaptchaSolveCode.SUCCESS) {
      throw new Error(`${provider.name} 识别失败: ${solveResult.message}`);
    }

    if (solveResult.data.points.length === 0) {
      throw new Error(`${provider.name} 识别结果无效: 无坐标点`);
    }

    const xPosition = solveResult.data.points[0].x;
    console.log(
      `${provider.name}: 识别成功, X坐标:`,
      xPosition,
      "ID:",
      solveResult.data.captchaId,
    );

    // 保存识别结果
    solveResultRef.current = solveResult;

    // 绘制调试红线
    drawDebugLine(canvas, xPosition);

    // 查找容器内的 GeeTest 元素
    const elements = findGeeTestElements(outerContainer);

    if (!elements.sliderBtn || !elements.sliderTrack) {
      console.log(`${provider.name}: 滑块元素调试:`, {
        sliderContainer: elements.sliderContainer?.className,
        sliderBtn: elements.sliderBtn?.className,
        sliderTrack: elements.sliderTrack?.className,
      });
      throw new Error("未找到滑块按钮元素");
    }

    if (!elements.sliceElement || !elements.captchaWindow) {
      console.log(`${provider.name}: 拼图块元素调试:`, {
        sliceElement: elements.sliceElement?.className,
        captchaWindow: elements.captchaWindow?.className,
      });
      throw new Error("未找到拼图块元素");
    }

    // 构建 bypass 上下文
    const bypassContext: GeeTestSlideBypassContext = {
      container: outerContainer,
      sliderBtn: elements.sliderBtn,
      sliderTrack: elements.sliderTrack,
      sliceElement: elements.sliceElement,
      captchaWindow: elements.captchaWindow,
      canvasWidth: canvas.width,
    };

    // 执行 Provider 的 bypass 逻辑
    if (provider.bypassGeeTestSlide) {
      console.log(`${provider.name}: 开始执行滑块 bypass...`);
      const bypassResult = await provider.bypassGeeTestSlide(
        bypassContext,
        solveResult,
      );
      if (!bypassResult.success) {
        throw new Error(
          `${provider.name} bypass 失败: ${bypassResult.message}`,
        );
      }
      console.log(`${provider.name}: 滑块 bypass 完成`);
    } else {
      throw new Error(`${provider.name} 不支持 GeeTest 滑块 bypass`);
    }

    return solveResult.data.captchaId;
  }, [getOuterContainer, captureGeeTestBox, drawDebugLine, provider]);

  const handleSuccess = useCallback(async () => {
    if (!captchaRef.current) return;

    const result = captchaRef.current.getValidate();
    if (!result) return;

    console.log("GeeTest v4 前端验证成功:", result);

    // 服务器验证
    setStatus("validating");
    setStatusMessage("正在验证...");

    try {
      const response = await validateGeeTest(result);
      console.log("GeeTest v4 服务器验证结果:", response);

      if (response.result === "success") {
        setStatus("success");
        setStatusMessage(response.msg || "验证成功");
        onComplete?.();
      } else {
        setStatus("error");
        setStatusMessage(response.msg || "验证失败");
      }
    } catch (error) {
      console.error("GeeTest v4 服务器验证失败:", error);
      const errorMessage =
        error instanceof Error ? error.message : "服务器验证失败";
      setStatus("error");
      setStatusMessage(errorMessage);
      onComplete?.();
    }
  }, [onComplete]);

  const handleFail = useCallback(
    async (err: GeeTest4Error) => {
      console.error("GeeTest v4 validation failed:", err);

      // 如果有识别 ID，调用报错接口
      if (recognitionIdRef.current) {
        try {
          console.log(
            `${provider.name}: 调用报错接口, ID:`,
            recognitionIdRef.current,
          );
          const reportResult = await provider.reportError(
            recognitionIdRef.current,
          );
          console.log(`${provider.name}: 报错结果:`, reportResult);
        } catch (reportError) {
          console.error(`${provider.name}: 报错失败:`, reportError);
        }
        recognitionIdRef.current = null;
      }

      // 检查是否可以重试
      if (retryCountRef.current < MAX_RETRY_COUNT) {
        retryCountRef.current += 1;
        console.log(
          `${provider.name}: 开始第 ${retryCountRef.current} 次重试...`,
        );
        setStatus("retrying");
        setStatusMessage(
          `验证失败，正在重试 (${retryCountRef.current}/${MAX_RETRY_COUNT})...`,
        );

        // 验证码窗口已经显示，等待GeeTest刷新新的验证码图片后重新识别
        setTimeout(async () => {
          try {
            setStatus("solving");
            setStatusMessage(
              `${provider.name} 识别中 (重试 ${retryCountRef.current}/${MAX_RETRY_COUNT})...`,
            );

            const newId = await autoSolveCaptcha();
            recognitionIdRef.current = newId;
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : `${provider.name} 识别失败`;
            console.error(`${provider.name} error:`, errorMessage);
            setStatus("error");
            setStatusMessage(errorMessage);
            onComplete?.();
          }
        }, 3000); // 等待验证码图片刷新完成
      } else {
        setStatus("error");
        setStatusMessage(`验证失败: ${err.msg || "已达最大重试次数"}`);
        retryCountRef.current = 0; // 重置重试计数
        onComplete?.();
      }
    },
    [provider, autoSolveCaptcha, onComplete],
  );

  const handleError = useCallback(
    (err: GeeTest4Error) => {
      console.error("GeeTest v4 error:", err);
      setLoadError(err.msg || "Unknown error");
      onComplete?.();
    },
    [onComplete],
  );

  const handleReady = useCallback(() => {
    setIsLoading(false);
    // 重置重试计数
    retryCountRef.current = 0;

    const outerContainer = getOuterContainer();
    if (!outerContainer) return;

    // 自动显示验证码
    setTimeout(() => {
      autoClickCaptchaButton(outerContainer);

      // 等待验证码图片加载后进行识别
      setTimeout(async () => {
        try {
          setStatus("solving");
          setStatusMessage(`${provider.name} 识别中...`);
          // sleep for 500ms to ensure images are fully loaded
          // await new Promise((resolve) => setTimeout(resolve, 500000));
          const id = await autoSolveCaptcha();
          recognitionIdRef.current = id;
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : `${provider.name} 识别失败`;
          console.error(`${provider.name} error:`, errorMessage);
          setStatus("error");
          setStatusMessage(errorMessage);
          onComplete?.();
        }
      }, 2000); // 等待验证码图片加载完成
    }, 1000);
  }, [provider, getOuterContainer, autoSolveCaptcha, onComplete]);

  const handleClose = useCallback(() => {
    // 验证码关闭时重置状态
    setStatus("idle");
    setStatusMessage("");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initCaptcha = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        await loadGeeTestV4Script();

        if (!isMounted || !containerRef.current) return;

        if (typeof window.initGeetest4 !== "function") {
          throw new Error("GeeTest v4 SDK not loaded properly");
        }

        const config: GeeTest4Config = {
          captchaId: captchaType.geetestId || "",
          riskType: captchaType.riskType,
          product: "float",
          language: "zh-cn",
          onError: handleError,
        };

        window.initGeetest4(config, (captcha) => {
          if (!isMounted) {
            captcha.destroy();
            return;
          }

          captchaRef.current = captcha;

          captcha
            .onReady(handleReady)
            .onSuccess(handleSuccess)
            .onFail(handleFail)
            .onError(handleError)
            .onClose(handleClose);

          captcha.appendTo(`#${innerContainerId.current}`);
        });
      } catch (err) {
        if (isMounted) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "Failed to initialize GeeTest v4";
          setLoadError(errorMessage);
          setIsLoading(false);
          console.error("GeeTest v4 initialization error:", err);
        }
      }
    };

    initCaptcha();

    return () => {
      isMounted = false;
      if (captchaRef.current) {
        captchaRef.current.destroy();
        captchaRef.current = null;
      }
    };
  }, [
    captchaType,
    handleSuccess,
    handleFail,
    handleError,
    handleReady,
    handleClose,
  ]);

  return (
    <div className="w-full h-full">
      <div className="w-full h-full bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h1 className="text-lg font-semibold text-slate-800">人机验证</h1>
          <p className="text-sm text-slate-500 mt-1">请完成验证以继续</p>
        </div>

        {/* 验证码区域 */}
        <div className="p-6 min-h-[200px] flex-1 flex flex-col items-center justify-center">
          {isLoading && (
            <div className="flex items-center justify-center p-4 text-slate-500">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-2" />
              <span className="text-sm">加载验证码...</span>
            </div>
          )}
          {loadError && (
            <div className="text-red-500 p-4 text-center text-sm">
              <p>加载失败: {loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded hover:bg-slate-700 transition-colors"
              >
                重新加载
              </button>
            </div>
          )}
          <div
            id={innerContainerId.current}
            ref={containerRef}
            className={`flex justify-center items-center ${isLoading || loadError ? "hidden" : ""}`}
          />
        </div>

        {/* 状态区域 */}
        {status !== "idle" && (
          <div className="px-6 pb-6">
            <div
              className={`flex items-center gap-3 p-3 rounded-lg ${
                status === "solving"
                  ? "bg-blue-50"
                  : status === "retrying"
                    ? "bg-orange-50"
                    : status === "validating"
                      ? "bg-amber-50"
                      : status === "success"
                        ? "bg-emerald-50"
                        : "bg-red-50"
              }`}
            >
              {(status === "solving" ||
                status === "validating" ||
                status === "retrying") && (
                <div
                  className={`w-4 h-4 border-2 rounded-full animate-spin ${
                    status === "solving"
                      ? "border-blue-500 border-t-transparent"
                      : status === "retrying"
                        ? "border-orange-500 border-t-transparent"
                        : "border-amber-500 border-t-transparent"
                  }`}
                />
              )}
              {status === "success" && (
                <svg
                  className="w-4 h-4 text-emerald-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {status === "error" && (
                <svg
                  className="w-4 h-4 text-red-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              <span
                className={`text-sm ${
                  status === "solving"
                    ? "text-blue-700"
                    : status === "retrying"
                      ? "text-orange-700"
                      : status === "validating"
                        ? "text-amber-700"
                        : status === "success"
                          ? "text-emerald-700"
                          : "text-red-700"
                }`}
              >
                {statusMessage}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 底部 */}
      <p className="text-center text-xs text-slate-400 mt-4">
        Powered by GeeTest v4 | Provider: {provider.name}
      </p>
    </div>
  );
}

export default GeeTestV4Captcha;
