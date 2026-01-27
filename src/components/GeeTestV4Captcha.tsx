import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { GeeTest4Config, GeeTest4Error } from "../types/geetest4.d.ts";
import type { GeeTestSlideBypassContext } from "../utils/captcha/type/provider.ts";
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

// Import from separated modules
import type { GeeTestV4CaptchaProps, CaptchaRefs } from "../types/captcha";
import type { CaptchaStatus } from "../consts/captcha";
import { MAX_RETRY_COUNT, CAPTCHA_DELAYS } from "../consts/captcha";
import { getErrorMessage, generateContainerId } from "../utils/helpers";
import { LoadingSpinner, ErrorDisplay, StatusIndicator } from "./ui";

const logger = createModuleLogger("GeeTestV4Captcha");

/**
 * GeeTest v4 验证码组件
 * 支持 Provider 模式和容器隔离
 */
export function GeeTestV4Captcha({
  captchaType,
  provider,
  containerId,
  onComplete,
}: GeeTestV4CaptchaProps) {
  // Refs
  const innerContainerId = useRef(generateContainerId("geetest-inner"));
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<CaptchaRefs>({
    captcha: null,
    recognitionId: null,
    solveResult: null,
    retryCount: 0,
  });

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<CaptchaStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Memoized getter for outer container
  const getOuterContainer = useCallback(
    () => document.getElementById(containerId),
    [containerId],
  );

  // Capture screenshot of GeeTest box
  const captureGeeTestBox = useCallback(async () => {
    try {
      logger.log("截图目标容器ID:", containerId);
      const result = await captureScreenshot(containerId);
      logger.log("截图元素尺寸:", {
        width: result.canvas.width,
        height: result.canvas.height,
      });
      logger.log("验证码截图成功");
      logScreenshotPreview(result, 400, 300);
      return result;
    } catch (error) {
      logger.error("截图失败:", error);
      return null;
    }
  }, [containerId]);

  // Auto solve captcha using provider
  const autoSolveCaptcha = useCallback(async (): Promise<string> => {
    const outerContainer = getOuterContainer();
    if (!outerContainer) throw new Error("未找到外部容器");

    // Wait and capture screenshot
    await new Promise((resolve) =>
      setTimeout(resolve, CAPTCHA_DELAYS.SCREENSHOT),
    );
    const captureResult = await captureGeeTestBox();
    if (!captureResult) throw new Error("截图失败");

    const { base64, canvas } = captureResult;
    logger.log(`${provider.name}: 开始识别验证码...`);

    // Call provider to solve
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

    // Save result and draw debug overlay
    refs.current.solveResult = solveResult;
    drawDebugOverlay(canvas, {
      type: "vertical-line",
      points: [{ x: xPosition }],
      providerName: provider.name,
    });

    // Find GeeTest elements
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

    // Build bypass context and execute
    const bypassContext: GeeTestSlideBypassContext = {
      container: outerContainer,
      sliderBtn: elements.sliderBtn,
      sliderTrack: elements.sliderTrack,
      sliceElement: elements.sliceElement,
      captchaWindow: elements.captchaWindow,
      canvasWidth: canvas.width,
    };

    if (!provider.bypassGeeTestSlide) {
      throw new Error(`${provider.name} 不支持 GeeTest 滑块 bypass`);
    }

    logger.log(`${provider.name}: 开始执行滑块 bypass...`);
    const bypassResult = await provider.bypassGeeTestSlide(
      bypassContext,
      solveResult,
    );

    if (!bypassResult.success) {
      throw new Error(`${provider.name} bypass 失败: ${bypassResult.message}`);
    }

    logger.log(`${provider.name}: 滑块 bypass 完成`);
    return solveResult.data.captchaId;
  }, [getOuterContainer, captureGeeTestBox, provider]);

  // Handle successful validation
  const handleSuccess = useCallback(async () => {
    const captcha = refs.current.captcha;
    if (!captcha) return;

    const result = captcha.getValidate();
    if (!result) return;

    logger.log("GeeTest v4 前端验证成功:", result);
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
      setStatus("error");
      setStatusMessage(getErrorMessage(error, "服务器验证失败"));
      onComplete?.();
    }
  }, [onComplete]);

  // Handle validation failure with retry logic
  const handleFail = useCallback(
    async (err: GeeTest4Error) => {
      logger.error("GeeTest v4 validation failed:", err);

      // Report error if we have a recognition ID
      if (refs.current.recognitionId) {
        try {
          logger.log(
            `${provider.name}: 调用报错接口, ID:`,
            refs.current.recognitionId,
          );
          const reportResult = await provider.reportError(
            refs.current.recognitionId,
          );
          logger.log(`${provider.name}: 报错结果:`, reportResult);
        } catch (reportError) {
          logger.error(`${provider.name}: 报错失败:`, reportError);
        }
        refs.current.recognitionId = null;
      }

      // Retry logic
      if (refs.current.retryCount < MAX_RETRY_COUNT) {
        refs.current.retryCount += 1;
        const retryNum = refs.current.retryCount;
        logger.log(`${provider.name}: 开始第 ${retryNum} 次重试...`);
        setStatus("retrying");
        setStatusMessage(
          `验证失败，正在重试 (${retryNum}/${MAX_RETRY_COUNT})...`,
        );

        setTimeout(async () => {
          try {
            setStatus("solving");
            setStatusMessage(
              `${provider.name} 识别中 (重试 ${retryNum}/${MAX_RETRY_COUNT})...`,
            );
            refs.current.recognitionId = await autoSolveCaptcha();
          } catch (error) {
            logger.error(
              `${provider.name} error:`,
              getErrorMessage(error, "识别失败"),
            );
            setStatus("error");
            setStatusMessage(
              getErrorMessage(error, `${provider.name} 识别失败`),
            );
            onComplete?.();
          }
        }, CAPTCHA_DELAYS.RETRY_WAIT);
      } else {
        setStatus("error");
        setStatusMessage(`验证失败: ${err.msg || "已达最大重试次数"}`);
        refs.current.retryCount = 0;
        onComplete?.();
      }
    },
    [provider, autoSolveCaptcha, onComplete],
  );

  // Handle GeeTest error
  const handleError = useCallback(
    (err: GeeTest4Error) => {
      logger.error("GeeTest v4 error:", err);
      setLoadError(err.msg || "Unknown error");
      onComplete?.();
    },
    [onComplete],
  );

  // Handle captcha ready
  const handleReady = useCallback(() => {
    setIsLoading(false);
    refs.current.retryCount = 0;

    const outerContainer = getOuterContainer();
    if (!outerContainer) return;

    setTimeout(() => {
      autoClickCaptchaButton(outerContainer);

      setTimeout(async () => {
        try {
          setStatus("solving");
          setStatusMessage(`${provider.name} 识别中...`);
          refs.current.recognitionId = await autoSolveCaptcha();
        } catch (error) {
          logger.error(
            `${provider.name} error:`,
            getErrorMessage(error, "识别失败"),
          );
          setStatus("error");
          setStatusMessage(getErrorMessage(error, `${provider.name} 识别失败`));
          onComplete?.();
        }
      }, CAPTCHA_DELAYS.IMAGE_LOAD);
    }, CAPTCHA_DELAYS.AUTO_CLICK);
  }, [provider, getOuterContainer, autoSolveCaptcha, onComplete]);

  // Handle captcha close
  const handleClose = useCallback(() => {
    setStatus("idle");
    setStatusMessage("");
  }, []);

  // Initialize captcha
  useEffect(() => {
    let isMounted = true;
    // Capture ref value at effect creation time per eslint react-hooks/exhaustive-deps
    const currentRefs = refs.current;

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

          currentRefs.captcha = captcha;

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
          setLoadError(getErrorMessage(err, "Failed to initialize GeeTest v4"));
          setIsLoading(false);
          logger.error("GeeTest v4 initialization error:", err);
        }
      }
    };

    initCaptcha();

    return () => {
      isMounted = false;
      if (currentRefs.captcha) {
        currentRefs.captcha.destroy();
        currentRefs.captcha = null;
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

  // Determine container visibility
  const containerClassName = useMemo(
    () =>
      `flex justify-center items-center ${isLoading || loadError ? "hidden" : ""}`,
    [isLoading, loadError],
  );

  return (
    <div className="w-full h-full">
      <div className="w-full h-full bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h1 className="text-lg font-semibold text-slate-800">人机验证</h1>
          <p className="text-sm text-slate-500 mt-1">请完成验证以继续</p>
        </div>

        {/* Captcha Area */}
        <div className="p-6 min-h-[200px] flex-1 flex flex-col items-center justify-center">
          {isLoading && <LoadingSpinner />}
          {loadError && <ErrorDisplay error={loadError} />}
          <div
            id={innerContainerId.current}
            ref={containerRef}
            className={containerClassName}
          />
        </div>

        {/* Status Indicator */}
        <StatusIndicator status={status} message={statusMessage} />
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-slate-400 mt-4">
        Powered by GeeTest v4 | Provider: {provider.name}
      </p>
    </div>
  );
}

export default GeeTestV4Captcha;
