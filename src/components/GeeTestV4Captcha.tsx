import { useEffect, useRef, useCallback, useState } from "react";
import html2canvas from "html2canvas";
import type {
  GeeTest4Instance,
  GeeTest4Config,
  GeeTest4ValidateResult,
  GeeTest4Error,
} from "../types/geetest4.d.ts";
import {
  validateGeeTest,
  type GeeTestValidateResponse,
} from "../utils/geetest";
import { recognizeGapX } from "../utils/ttshitu";

// GeeTest v4 CDN URL
const GEETEST4_JS_URL = "https://static.geetest.com/v4/gt4.js";

export interface GeeTestV4CaptchaProps {
  /** GeeTest captchaId */
  captchaId: string;
  /** 标题 */
  title?: string;
  /** 副标题 */
  subtitle?: string;
  /** 是否自动验证到服务器 */
  autoValidate?: boolean;
  /** 是否自动显示验证码（跳过点击按钮步骤） */
  autoShow?: boolean;
  /** 是否启用 TTShitu 自动识别 */
  enableCaptchaSonic?: boolean;
  /** TTShitu 识别成功回调 */
  onCaptchaSonicSuccess?: (answers: number[]) => void;
  /** TTShitu 识别失败回调 */
  onCaptchaSonicError?: (error: string) => void;
  /** 服务器验证成功回调 */
  onServerSuccess?: (response: GeeTestValidateResponse) => void;
  /** 服务器验证失败回调 */
  onServerError?: (error: string) => void;
  /** 前端验证成功回调 */
  onSuccess?: (result: GeeTest4ValidateResult) => void;
  /** 验证失败回调 */
  onFail?: (error: GeeTest4Error) => void;
  /** 验证错误回调 */
  onError?: (error: GeeTest4Error) => void;
  /** 验证码准备就绪回调 */
  onReady?: () => void;
  /** 验证码关闭回调 */
  onClose?: () => void;
  /** 产品形式 */
  product?: "popup" | "float" | "bind";
  /** 语言 */
  language?: string;
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示验证详情 */
  showDetails?: boolean;
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
async function simulateSlide(targetX: number, canvasWidth: number): Promise<void> {
  // 查找滑块容器和滑块按钮元素
  // 根据 HTML 结构: geetest_slider > geetest_track > geetest_btn
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

  const startX = btnRect.left + btnRect.width / 2;
  const startY = btnRect.top + btnRect.height / 2;

  // 获取拼图块和验证码窗口的位置信息
  const sliceRect = sliceElement.getBoundingClientRect();
  const windowRect = captchaWindow.getBoundingClientRect();

  // 计算缩放比例：canvas 截图尺寸 vs 实际 DOM 元素尺寸
  // html2canvas 可能会因为 devicePixelRatio 产生不同尺寸的截图
  const scaleFactor = windowRect.width / canvasWidth;

  // 将 TTShitu 返回的 targetX（基于 canvas 坐标）转换为实际 DOM 坐标
  const scaledTargetX = targetX * scaleFactor;

  // 计算拼图块当前在验证码图片中的相对x位置
  // sliceStartX 是拼图块左边缘相对于验证码窗口左边缘的位置（已经是 DOM 坐标）
  const sliceStartX = sliceRect.left - windowRect.left;

  // 硬编码偏移量校正（用于补偿识别和实际位置之间的固定偏差）
  // 负值表示向左偏移，正值表示向右偏移
  const X_OFFSET = -20;

  // 计算需要滑动的距离
  // scaledTargetX 是缺口在 DOM 中的实际 x 坐标
  // 滑动距离 = 目标位置 - 起始位置 + 偏移量校正
  const slideDistance = scaledTargetX - sliceStartX + X_OFFSET;

  // 最终的鼠标目标位置
  const endX = startX + slideDistance;
  const endY = startY;

  // 详细调试信息
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
 * GeeTest v4 验证码组件
 * 包含完整的 UI 卡片、状态显示和服务器验证逻辑
 */
export function GeeTestV4Captcha({
  captchaId,
  title = "人机验证",
  subtitle = "请完成验证以继续",
  autoValidate = true,
  autoShow = false,
  enableCaptchaSonic = false,
  onCaptchaSonicSuccess,
  onCaptchaSonicError,
  onServerSuccess,
  onServerError,
  onSuccess,
  onFail,
  onError,
  onReady,
  onClose,
  product = "bind",
  language = "zh-cn",
  className = "",
  showDetails = true,
}: GeeTestV4CaptchaProps) {
  const containerId = useRef(
    `geetest-v4-${Math.random().toString(36).substring(2, 9)}`,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const captchaRef = useRef<GeeTest4Instance | null>(null);

  // SDK 加载状态
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 验证状态
  const [validateResult, setValidateResult] =
    useState<GeeTest4ValidateResult | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [serverResult, setServerResult] =
    useState<GeeTestValidateResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // CaptchaSonic 状态
  const [isSolving, setIsSolving] = useState(false);
  const [captchaSonicResult, setCaptchaSonicResult] = useState<number[] | null>(
    null,
  );
  const [captchaSonicError, setCaptchaSonicError] = useState<string | null>(
    null,
  );

  const handleSuccess = useCallback(async () => {
    if (!captchaRef.current) return;

    const result = captchaRef.current.getValidate();
    if (!result) return;

    console.log("GeeTest v4 前端验证成功:", result);
    setValidateResult(result);
    setIsVerified(true);
    setServerError(null);
    setServerResult(null);

    onSuccess?.(result);

    if (autoValidate) {
      setIsValidating(true);

      try {
        const response = await validateGeeTest(result);
        console.log("GeeTest v4 服务器验证结果:", response);
        setServerResult(response);

        if (response.result === "success") {
          onServerSuccess?.(response);
        } else {
          onServerError?.(response.msg || "验证失败");
        }
      } catch (error) {
        console.error("GeeTest v4 服务器验证失败:", error);
        const errorMessage =
          error instanceof Error ? error.message : "服务器验证失败";
        setServerError(errorMessage);
        onServerError?.(errorMessage);
      } finally {
        setIsValidating(false);
      }
    }
  }, [autoValidate, onSuccess, onServerSuccess, onServerError]);

  const handleFail = useCallback(
    (err: GeeTest4Error) => {
      console.error("GeeTest v4 validation failed:", err);
      setIsVerified(false);
      setServerResult(null);
      setServerError(null);
      onFail?.(err);
    },
    [onFail],
  );

  const handleError = useCallback(
    (err: GeeTest4Error) => {
      console.error("GeeTest v4 error:", err);
      setLoadError(err.msg || "Unknown error");
      onError?.(err);
    },
    [onError],
  );

  const handleReady = useCallback(() => {
    setIsLoading(false);
    onReady?.();

    // 如果启用 autoShow，自动显示验证码（跳过点击按钮步骤）
    if (autoShow) {
      // 延迟一点确保 DOM 已渲染
      setTimeout(() => {
        const container = document.getElementById(containerId.current);
        if (container) {
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

        // 如果启用 TTShitu，在验证码图片加载后进行识别
        if (enableCaptchaSonic) {
          // 等待验证码图片加载完成
          setTimeout(async () => {
            try {
              setIsSolving(true);
              setCaptchaSonicError(null);

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
              console.log(
                "TTShitu: 截图 dataUrl:",
                dataUrl.substring(0, 100) + "...",
              );

              console.log("TTShitu: 开始识别验证码...");

              // 调用 TTShitu 单缺口识别
              const xPosition = await recognizeGapX(base64);

              console.log("TTShitu: 识别成功, X坐标:", xPosition);
              
              // 创建新的 canvas 来绘制红线
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
              
              setCaptchaSonicResult([xPosition]);
              onCaptchaSonicSuccess?.([xPosition]);

              // 自动滑动滑块，传入 canvas 宽度用于计算缩放
              console.log("TTShitu: 开始自动滑动滑块...");
              console.log("TTShitu: Canvas 尺寸:", canvas.width, "x", canvas.height);
              await simulateSlide(xPosition, canvas.width);
              console.log("TTShitu: 滑动完成");
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : "TTShitu 识别失败";
              console.error("TTShitu error:", errorMessage);
              setCaptchaSonicError(errorMessage);
              onCaptchaSonicError?.(errorMessage);
            } finally {
              setIsSolving(false);
            }
          }, 1500); // 增加等待时间确保图片加载完成
        }
      }, 500);
    }
  }, [
    onReady,
    autoShow,
    enableCaptchaSonic,
    onCaptchaSonicSuccess,
    onCaptchaSonicError,
  ]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

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
          captchaId,
          product,
          language,
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
    captchaId,
    product,
    language,
    handleSuccess,
    handleFail,
    handleError,
    handleReady,
    handleClose,
  ]);

  // 根据 product 类型决定宽度 - float 模式需要更大的空间
  const maxWidthClass = product === "float" ? "max-w-2xl" : "max-w-sm";

  return (
    <div className={`w-full ${maxWidthClass} ${className}`}>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
        {/* 头部 */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>

        {/* 验证码区域 - 移除 overflow-hidden，确保验证码完全显示 */}
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
        <div className="px-6 pb-6 space-y-3">
          {/* CaptchaSonic 识别中 */}
          {isSolving && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-blue-700">
                CaptchaSonic 识别中...
              </span>
            </div>
          )}

          {/* CaptchaSonic 识别成功 */}
          {captchaSonicResult && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <svg
                className="w-4 h-4 text-blue-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm text-blue-700">
                CaptchaSonic 识别完成: [{captchaSonicResult.join(", ")}]
              </span>
            </div>
          )}

          {/* CaptchaSonic 识别错误 */}
          {captchaSonicError && (
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
              <svg
                className="w-4 h-4 text-orange-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm text-orange-700">
                {captchaSonicError}
              </span>
            </div>
          )}

          {/* 验证中 */}
          {isValidating && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-amber-700">正在验证...</span>
            </div>
          )}

          {/* 验证成功 */}
          {serverResult?.result === "success" && (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
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
              <span className="text-sm text-emerald-700">
                {serverResult.msg || "验证成功"}
              </span>
            </div>
          )}

          {/* 验证失败 */}
          {serverResult && serverResult.result !== "success" && (
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
              <svg
                className="w-4 h-4 text-red-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm text-red-700">
                {serverResult.msg || "验证失败"}
              </span>
            </div>
          )}

          {/* 请求错误 */}
          {serverError && (
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
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
              <span className="text-sm text-red-700">{serverError}</span>
            </div>
          )}
        </div>

        {/* 验证详情 */}
        {showDetails && isVerified && validateResult && !isValidating && (
          <div className="px-6 pb-6">
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer text-sm text-slate-600 hover:text-slate-800">
                <span>查看验证详情</span>
                <svg
                  className="w-4 h-4 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs font-mono space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">lot_number</span>
                  <span className="text-slate-700 truncate max-w-[160px]">
                    {validateResult.lot_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">gen_time</span>
                  <span className="text-slate-700">
                    {validateResult.gen_time}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">pass_token</span>
                  <span className="text-slate-700 truncate max-w-[160px]">
                    {validateResult.pass_token.substring(0, 20)}...
                  </span>
                </div>
              </div>
            </details>
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
