import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeeTest4Config, GeeTest4Error } from "../../../types/geetest4";
import {
  CaptchaSolveCode,
  type ICaptchaProvider,
  type CaptchaSolveResult,
} from "../../../utils/captcha/type/provider.ts";
import {
  autoClickCaptchaButton,
  loadGeeTestV4Script,
} from "../../../utils/geetest/geetest.ts";
import { validateGeeTest } from "../../../utils/geetest/myServer.ts";
import { createModuleLogger } from "../../../utils/logger.ts";
import type { CaptchaStatus } from "../../../consts/captcha.ts";
import { CAPTCHA_DELAYS, MAX_RETRY_COUNT } from "../../../consts/captcha.ts";
import type {
  CaptchaRefs,
  GeeTestV4CaptchaProps,
} from "../../../types/captcha.ts";
import {
  generateContainerId,
  getErrorMessage,
} from "../../../utils/helpers.ts";
import {
  ErrorDisplay,
  LoadingSpinner,
  StatusIndicator,
} from "../../ui/index.ts";

const logger = createModuleLogger("GeeTestV4Base");

export interface GeetestV4BaseProps extends GeeTestV4CaptchaProps {
  /**
   * Specific auto-solve implementation for the captcha type
   */
  onAutoSolve: (
    container: HTMLElement,
    provider: ICaptchaProvider,
  ) => Promise<CaptchaSolveResult>;
}

/**
 * GeeTest v4 Base Component
 * Encapsulates common logic for initialization, state management, and lifecycle
 */
export function GeetestV4Base(props: GeetestV4BaseProps) {
  const { captchaInfo, provider, onComplete, onAutoSolve } = props;

  // Refs
  const innerContainerId = useRef(generateContainerId());
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

  // Auto solve wrapper
  const autoSolveCaptcha = useCallback(async (): Promise<string> => {
    const parentContainer = document.getElementById(captchaInfo.containerId);
    if (!parentContainer) throw new Error("未找到外部容器");

    // Wait for animation/render
    await new Promise((resolve) =>
      setTimeout(resolve, CAPTCHA_DELAYS.SCREENSHOT),
    );

    // Delegate specific solving logic to the child component
    const solveResult = await onAutoSolve(parentContainer, provider);

    if (solveResult.code !== CaptchaSolveCode.SUCCESS) {
      throw new Error(`${provider.name} 识别失败: ${solveResult.message}`);
    }

    // Save result
    refs.current.solveResult = solveResult;
    return solveResult.data.captchaId;
  }, [captchaInfo.containerId, provider, onAutoSolve]);

  // Handle successful validation (Front-end)
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
          await provider.reportError(refs.current.recognitionId);
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

    if (!containerRef.current) return;

    setTimeout(() => {
      if (!containerRef.current) return;
      autoClickCaptchaButton(containerRef.current);

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
  }, [provider, containerRef, autoSolveCaptcha, onComplete]);

  // Handle captcha close
  const handleClose = useCallback(() => {
    setStatus("idle");
    setStatusMessage("");
  }, []);

  // Initialize captcha
  useEffect(() => {
    let isMounted = true;
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
          captchaId: captchaInfo.geetestId || "",
          riskType: captchaInfo.riskType,
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
    captchaInfo,
    handleSuccess,
    handleFail,
    handleError,
    handleReady,
    handleClose,
  ]);

  const containerClassName = useMemo(
    () =>
      `flex justify-center items-center ${
        isLoading || loadError ? "hidden" : ""
      }`,
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
