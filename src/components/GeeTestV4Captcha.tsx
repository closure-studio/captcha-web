import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GeeTest4Config,
  GeeTest4Error,
  GeeTest4Instance,
} from "../types/geetest4.d.ts";
import type { CaptchaType } from "../types/type.ts";
import type {
  CaptchaSolveResult,
  GeeTestSlideBypassContext,
  ICaptchaProvider,
} from "../utils/captcha/type/provider.ts";
import {
  CaptchaSolveCode,
  CaptchaType as ProviderCaptchaType,
} from "../utils/captcha/type/provider.ts";
import { validateGeeTest } from "../utils/geetest/myServer.ts";
import {
  captureScreenshot,
  logScreenshotPreview,
  drawDebugOverlay,
} from "../utils/screenshot";
import {
  autoClickCaptchaButton,
  findGeeTestElements,
  loadGeeTestV4Script,
} from "../utils/geetest/geetest.ts";
import { createModuleLogger } from "../utils/logger";

const logger = createModuleLogger("GeeTestV4Captcha");

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
   * 使用封装的截图工具对外部容器进行截图
   */
  const captureGeeTestBox = useCallback(async (): Promise<{
    base64: string;
    canvas: HTMLCanvasElement;
  } | null> => {
    try {
      logger.log("截图目标容器ID:", containerId);

      // 使用封装的截图工具
      const result = await captureScreenshot(containerId);

      logger.log("截图元素尺寸:", {
        width: result.canvas.width,
        height: result.canvas.height,
      });

      // 在控制台打印截图预览
      logger.log("验证码截图成功");
      logScreenshotPreview(result, 400, 300);

      return { base64: result.base64, canvas: result.canvas };
    } catch (error) {
      logger.error("截图失败:", error);
      return null;
    }
  }, [containerId]);

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

    logger.log(`${provider.name}: 开始识别验证码...`);

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
    logger.log(
      `${provider.name}: 识别成功, X坐标:`,
      xPosition,
      "ID:",
      solveResult.data.captchaId,
    );

    // 保存识别结果
    solveResultRef.current = solveResult;

    // 绘制调试标记
    drawDebugOverlay(canvas, {
      type: "vertical-line",
      points: [{ x: xPosition }],
      providerName: provider.name,
    });

    // 查找容器内的 GeeTest 元素
    const elements = findGeeTestElements(outerContainer);

    if (!elements.sliderBtn || !elements.sliderTrack) {
      logger.log(`${provider.name}: 滑块元素调试:`, {
        sliderContainer: elements.sliderContainer?.className,
        sliderBtn: elements.sliderBtn?.className,
        sliderTrack: elements.sliderTrack?.className,
      });
      throw new Error("未找到滑块按钮元素");
    }

    if (!elements.sliceElement || !elements.captchaWindow) {
      logger.log(`${provider.name}: 拼图块元素调试:`, {
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
      logger.log(`${provider.name}: 开始执行滑块 bypass...`);
      const bypassResult = await provider.bypassGeeTestSlide(
        bypassContext,
        solveResult,
      );
      if (!bypassResult.success) {
        throw new Error(
          `${provider.name} bypass 失败: ${bypassResult.message}`,
        );
      }
      logger.log(`${provider.name}: 滑块 bypass 完成`);
    } else {
      throw new Error(`${provider.name} 不支持 GeeTest 滑块 bypass`);
    }

    return solveResult.data.captchaId;
  }, [getOuterContainer, captureGeeTestBox, provider]);

  const handleSuccess = useCallback(async () => {
    if (!captchaRef.current) return;

    const result = captchaRef.current.getValidate();
    if (!result) return;

    logger.log("GeeTest v4 前端验证成功:", result);

    // 服务器验证
    setStatus("validating");
    setStatusMessage("正在验证...");

    try {
      const response = await validateGeeTest(result);
      logger.log("GeeTest v4 服务器验证结果:", response);

      if (response.result === "success") {
        setStatus("success");
        setStatusMessage(response.msg || "验证成功");
        onComplete?.();
      } else {
        setStatus("error");
        setStatusMessage(response.msg || "验证失败");
      }
    } catch (error) {
      logger.error("GeeTest v4 服务器验证失败:", error);
      const errorMessage =
        error instanceof Error ? error.message : "服务器验证失败";
      setStatus("error");
      setStatusMessage(errorMessage);
      onComplete?.();
    }
  }, [onComplete]);

  const handleFail = useCallback(
    async (err: GeeTest4Error) => {
      logger.error("GeeTest v4 validation failed:", err);

      // 如果有识别 ID，调用报错接口
      if (recognitionIdRef.current) {
        try {
          logger.log(
            `${provider.name}: 调用报错接口, ID:`,
            recognitionIdRef.current,
          );
          const reportResult = await provider.reportError(
            recognitionIdRef.current,
          );
          logger.log(`${provider.name}: 报错结果:`, reportResult);
        } catch (reportError) {
          logger.error(`${provider.name}: 报错失败:`, reportError);
        }
        recognitionIdRef.current = null;
      }

      // 检查是否可以重试
      if (retryCountRef.current < MAX_RETRY_COUNT) {
        retryCountRef.current += 1;
        logger.log(
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
            logger.error(`${provider.name} error:`, errorMessage);
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
      logger.error("GeeTest v4 error:", err);
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
          logger.error(`${provider.name} error:`, errorMessage);
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
          logger.error("GeeTest v4 initialization error:", err);
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
