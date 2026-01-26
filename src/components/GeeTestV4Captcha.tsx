import html2canvas from "html2canvas";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GeeTest4Config,
  GeeTest4Error,
  GeeTest4Instance,
} from "../types/geetest4.d.ts";
import type { CaptchaType } from "../types/type.ts";
import { validateGeeTest } from "../utils/geetest";
import {
  predictTTShitu,
  reportErrorTTShitu,
  TTShituTypeId,
} from "../utils/ttshitu";

// GeeTest v4 CDN URL
const GEETEST4_JS_URL = "https://static.geetest.com/v4/gt4.js";

export interface GeeTestV4CaptchaProps {
  captchaType: CaptchaType;
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
 * 模拟滑动滑块
 * @param targetX 目标X坐标（缺口在截图canvas中的x坐标）
 * @param canvasWidth 截图canvas的宽度（用于计算缩放比例）
 */
async function simulateSlide(
  targetX: number,
  canvasWidth: number,
): Promise<void> {
  // 查找滑块容器和滑块按钮元素
  const sliderContainer = document.querySelector<HTMLElement>(
    'div[class*="geetest_slider"]',
  );
  const sliderBtn = sliderContainer?.querySelector<HTMLElement>(
    'div[class*="geetest_btn"]',
  );
  const sliderTrack = sliderContainer?.querySelector<HTMLElement>(
    'div[class*="geetest_track"]',
  );

  // 查找拼图块元素 (geetest_slice)
  const sliceElement = document.querySelector<HTMLElement>(
    'div[class*="geetest_slice"]',
  );

  // 查找验证码图片容器 (geetest_window)
  const captchaWindow = document.querySelector<HTMLElement>(
    'div[class*="geetest_window"]',
  );

  if (!sliderBtn || !sliderTrack) {
    console.log("TTShitu: 滑块元素调试:", {
      sliderContainer: sliderContainer?.className,
      sliderBtn: sliderBtn?.className,
      sliderTrack: sliderTrack?.className,
    });
    throw new Error("未找到滑块按钮元素");
  }

  if (!sliceElement || !captchaWindow) {
    console.log("TTShitu: 拼图块元素调试:", {
      sliceElement: sliceElement?.className,
      captchaWindow: captchaWindow?.className,
    });
    throw new Error("未找到拼图块元素");
  }

  console.log("TTShitu: 找到滑块按钮:", sliderBtn.className);
  console.log("TTShitu: 找到拼图块:", sliceElement.className);

  // 获取滑块按钮的位置
  const btnRect = sliderBtn.getBoundingClientRect();

  const startX = btnRect.left - btnRect.width;
  const startY = btnRect.top + btnRect.height / 2;

  // 获取拼图块和验证码窗口的位置信息
  const sliceRect = sliceElement.getBoundingClientRect();
  const windowRect = captchaWindow.getBoundingClientRect();

  // 计算缩放比例：canvas 截图尺寸 vs 实际 DOM 元素尺寸
  const scaleFactor = windowRect.width / canvasWidth;

  // 将 TTShitu 返回的 targetX（基于 canvas 坐标）转换为实际 DOM 坐标
  const scaledTargetX = targetX * scaleFactor;

  // 计算拼图块当前在验证码图片中的相对x位置
  const sliceStartX = sliceRect.left - windowRect.left;

  // 硬编码偏移量校正
  const X_OFFSET = -10;

  // 计算需要滑动的距离
  const slideDistance = scaledTargetX - sliceStartX + X_OFFSET;

  // 最终的鼠标目标位置
  const endX = startX + slideDistance;
  const endY = startY;

  // 调试信息
  console.log("TTShitu: ========== 滑动调试信息 ==========");
  console.log("TTShitu: 识别返回的 targetX (canvas坐标):", targetX);
  console.log("TTShitu: Canvas 宽度:", canvasWidth);
  console.log("TTShitu: 验证码窗口 DOM 宽度:", windowRect.width);
  console.log("TTShitu: 缩放比例 (DOM/Canvas):", scaleFactor);
  console.log("TTShitu: 缩放后的 targetX (DOM坐标):", scaledTargetX);
  console.log("TTShitu: X 偏移量校正:", X_OFFSET);
  console.log("TTShitu: 拼图块当前位置:", {
    left: sliceRect.left,
    relativeLeft: sliceStartX,
    width: sliceRect.width,
  });
  console.log("TTShitu: 滑动计算:", {
    sliceStartX,
    scaledTargetX,
    slideDistance,
    startX,
    endX,
  });
  console.log("TTShitu: =====================================");

  // 创建鼠标事件
  const createMouseEvent = (type: string, x: number, y: number) => {
    return new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === "mouseup" ? 0 : 1,
    });
  };

  // 创建 Touch 事件（用于支持移动端）
  const createTouchEvent = (type: string, x: number, y: number) => {
    const touch = new Touch({
      identifier: Date.now(),
      target: sliderBtn,
      clientX: x,
      clientY: y,
      pageX: x + window.scrollX,
      pageY: y + window.scrollY,
      screenX: x,
      screenY: y,
    });
    return new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: type === "touchend" ? [] : [touch],
      targetTouches: type === "touchend" ? [] : [touch],
      changedTouches: [touch],
    });
  };

  // 模拟拖动过程
  // 1. 鼠标/触摸按下
  sliderBtn.dispatchEvent(createMouseEvent("mousedown", startX, startY));
  sliderBtn.dispatchEvent(createTouchEvent("touchstart", startX, startY));

  // 2. 逐步移动（模拟人类滑动）
  const steps = 30;
  const deltaX = (endX - startX) / steps;

  for (let i = 1; i <= steps; i++) {
    const currentX = startX + deltaX * i;
    // 添加随机偏移模拟人类行为
    const randomY = startY + (Math.random() - 0.5) * 2;

    await new Promise((resolve) =>
      setTimeout(resolve, 15 + Math.random() * 10),
    );

    sliderBtn.dispatchEvent(createMouseEvent("mousemove", currentX, randomY));
    sliderBtn.dispatchEvent(createTouchEvent("touchmove", currentX, randomY));
    document.dispatchEvent(createMouseEvent("mousemove", currentX, randomY));
  }

  // 3. 最后一次移动到准确位置
  await new Promise((resolve) => setTimeout(resolve, 50));
  sliderBtn.dispatchEvent(createMouseEvent("mousemove", endX, endY));
  sliderBtn.dispatchEvent(createTouchEvent("touchmove", endX, endY));
  document.dispatchEvent(createMouseEvent("mousemove", endX, endY));

  // 4. 鼠标/触摸松开
  await new Promise((resolve) => setTimeout(resolve, 100));
  sliderBtn.dispatchEvent(createMouseEvent("mouseup", endX, endY));
  sliderBtn.dispatchEvent(createTouchEvent("touchend", endX, endY));
  document.dispatchEvent(createMouseEvent("mouseup", endX, endY));
}

/**
 * 使用 TTShitu 自动识别并滑动验证码
 * @returns 识别结果的 ID（用于报错）
 */
async function autoSolveCaptcha(): Promise<string> {
  // 查找整个验证码窗口元素
  const captchaWindow = document.querySelector<HTMLElement>(
    '[class*="geetest_window"]',
  );

  console.log("TTShitu: 验证码窗口元素:", captchaWindow?.className);

  if (!captchaWindow) {
    throw new Error("未找到验证码窗口元素");
  }

  // 使用 html2canvas 截取整个验证码窗口的截图
  const canvas = await html2canvas(captchaWindow, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
  });
  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1];

  // 在控制台打印截图预览
  console.log("TTShitu: 验证码窗口截图成功");
  console.log(
    "%c ",
    `
    font-size: 1px;
    padding: 100px 150px;
    background: url(${dataUrl}) no-repeat;
    background-size: contain;
  `,
  );

  console.log("TTShitu: 开始识别验证码...");

  // 调用 TTShitu 单缺口识别
  const { result, id } = await predictTTShitu(
    base64,
    TTShituTypeId.GAP_SINGLE_X,
  );
  const xPosition = parseInt(result, 10);

  if (isNaN(xPosition)) {
    throw new Error(`TTShitu 识别结果无效: "${result}"`);
  }

  console.log("TTShitu: 识别成功, X坐标:", xPosition, "ID:", id);

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
    console.log("TTShitu: 识别结果可视化（红线为识别的X坐标位置）:");
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

  // 自动滑动滑块，传入 canvas 宽度用于计算缩放
  console.log("TTShitu: 开始自动滑动滑块...");
  console.log("TTShitu: Canvas 尺寸:", canvas.width, "x", canvas.height);
  await simulateSlide(xPosition, canvas.width);
  console.log("TTShitu: 滑动完成");

  // 返回识别结果的 ID，用于报错
  return id;
}

/**
 * 自动点击 GeeTest 按钮显示验证码
 */
function autoClickCaptchaButton(containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;

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
 * 自动使用 TTShitu 识别并滑动验证码
 */
export function GeeTestV4Captcha(props: GeeTestV4CaptchaProps) {
  const { captchaType, onComplete } = props;
  // const { challenge, riskType, geetestId } = captchaType;
  const containerId = useRef(
    `geetest-v4-${Math.random().toString(36).substring(2, 9)}`,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const captchaRef = useRef<GeeTest4Instance | null>(null);

  // 存储当前识别结果的 ID，用于报错
  const recognitionIdRef = useRef<string | null>(null);
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
          console.log("TTShitu: 调用报错接口, ID:", recognitionIdRef.current);
          const reportResult = await reportErrorTTShitu(
            recognitionIdRef.current,
          );
          console.log("TTShitu: 报错成功:", reportResult);
        } catch (reportError) {
          console.error("TTShitu: 报错失败:", reportError);
        }
        recognitionIdRef.current = null;
      }

      // 检查是否可以重试
      if (retryCountRef.current < MAX_RETRY_COUNT) {
        retryCountRef.current += 1;
        console.log(`TTShitu: 开始第 ${retryCountRef.current} 次重试...`);
        setStatus("retrying");
        setStatusMessage(
          `验证失败，正在重试 (${retryCountRef.current}/${MAX_RETRY_COUNT})...`,
        );

        // 验证码窗口已经显示，等待GeeTest刷新新的验证码图片后重新识别
        // GeeTest 在验证失败后会自动刷新图片，需要等待足够的时间
        setTimeout(async () => {
          try {
            setStatus("solving");
            setStatusMessage(
              `TTShitu 识别中 (重试 ${retryCountRef.current}/${MAX_RETRY_COUNT})...`,
            );

            const newId = await autoSolveCaptcha();
            recognitionIdRef.current = newId;

            // 识别成功后状态会由 handleSuccess 更新
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "TTShitu 识别失败";
            console.error("TTShitu error:", errorMessage);
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
    [onComplete],
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

    // 自动显示验证码
    setTimeout(() => {
      autoClickCaptchaButton(containerId.current);

      // 等待验证码图片加载后进行 TTShitu 识别
      setTimeout(async () => {
        try {
          setStatus("solving");
          setStatusMessage("TTShitu 识别中...");

          const id = await autoSolveCaptcha();
          recognitionIdRef.current = id;

          // 识别成功后状态会由 handleSuccess 更新
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "TTShitu 识别失败";
          console.error("TTShitu error:", errorMessage);
          setStatus("error");
          setStatusMessage(errorMessage);
          onComplete?.();
        }
      }, 2000); // 等待验证码图片刷新完成
    }, 1000);
  }, [onComplete]);

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

          captcha.appendTo(`#${containerId.current}`);
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
    <div className="w-full max-w-2xl">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h1 className="text-lg font-semibold text-slate-800">人机验证</h1>
          <p className="text-sm text-slate-500 mt-1">请完成验证以继续</p>
        </div>

        {/* 验证码区域 */}
        <div className="p-6 min-h-[200px]">
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
            id={containerId.current}
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
        Powered by GeeTest v4
      </p>
    </div>
  );
}

export default GeeTestV4Captcha;
