import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { autoClickCaptchaButton } from "../adapters/geetest";
import { captchaConfig } from "../core/config/captcha.config";
import type { CaptchaCollector } from "../core/recognizers";
import type { ISolveStrategy, SolveResult } from "../core/strategies";
import type {
  AssetRecord,
  BypassRecord,
  CaptchaTask,
  GeetestValidateResult,
  RecognitionRecord,
  RecognizerName,
} from "../types/api";
import type { GeeTestAdapter, GeeTestError, GeeTestInstance } from "../types/geetest";
import { captchaTaskApi } from "../utils/api/captchaTaskApi";
import { uploadCaptchaData } from "../utils/captcha/upload";
import { recordCaptchaResult } from "../hooks/useSystemInfoManager";
import { getErrorMessage } from "../utils/helpers";
import { createModuleLogger } from "../utils/logger";
import {
  ErrorDisplay,
  LoadingSpinner,
  StatusIndicator,
} from "./ui/StatusComponents";

const logger = createModuleLogger("GeetestCaptcha");

// ============ Types ============

export type CaptchaStatus = "idle" | "solving" | "success" | "error" | "retrying";

export interface GeetestCaptchaProps {
  task: CaptchaTask;
  strategy: ISolveStrategy;
  adapter: GeeTestAdapter;
  onComplete?: () => void;
}

interface CaptchaRefs {
  captcha: GeeTestInstance | null;
  recognitionId: string | null;
  solveResult: SolveResult | null;
  retryCount: number;
  attemptSeq: number;
}

// ============ Collector Hook ============

interface FullCaptchaCollector extends CaptchaCollector {
  getArgs: () => { captures: Record<string, string>; metadata: Record<string, unknown> };
  reset: () => void;
}

function useCaptchaCollector(): FullCaptchaCollector {
  const capturesRef = useRef<Record<string, string>>({});
  const metadataRef = useRef<Record<string, unknown>>({});

  const addCapture = useCallback((name: string, base64: string) => {
    capturesRef.current[name] = base64;
  }, []);

  const setMetadata = useCallback((key: string, value: unknown) => {
    metadataRef.current[key] = value;
  }, []);

  const getArgs = useCallback(() => ({
    captures: { ...capturesRef.current },
    metadata: { ...metadataRef.current },
  }), []);

  const reset = useCallback(() => {
    capturesRef.current = {};
    metadataRef.current = {};
  }, []);

  return useMemo(
    () => ({ addCapture, setMetadata, getArgs, reset }),
    [addCapture, setMetadata, getArgs, reset],
  );
}

// ============ Main Component ============

/**
 * GeeTest 统一验证码组件
 * 通过 adapter 支持 V3 和 V4
 */
export function GeetestCaptcha(props: GeetestCaptchaProps) {
  const { task, strategy, adapter, onComplete } = props;

  // Refs
  const innerContainerId = useRef(crypto.randomUUID());
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const refs = useRef<CaptchaRefs>({
    captcha: null,
    recognitionId: null,
    solveResult: null,
    retryCount: 0,
    attemptSeq: 0,
  });

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<CaptchaStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const collector = useCaptchaCollector();
  const { delays, maxRetryCount } = captchaConfig;

  // 封装上报逻辑
  const submitTaskResult = useCallback(
    async (
      resultStatus: "success" | "failed" | "error",
      extra?: {
        result?: GeetestValidateResult;
        errorMessage?: string;
      },
    ) => {
      const duration = Date.now() - startTimeRef.current;

      // 记录统计数据
      recordCaptchaResult(resultStatus, duration);

      // 构建识别记录
      const solveResult = refs.current.solveResult;
      let recognition: RecognitionRecord | undefined;
      let bypass: BypassRecord | undefined;
      let assets: AssetRecord[] | undefined;

      if (solveResult) {
        const { recognizeResult, bypassResult } = solveResult;

        // 识别记录
        recognition = {
          recognizerName: (collector.getArgs().metadata.recognizerName as RecognizerName) || "Gemini",
          success: recognizeResult.success,
          attemptSeq: refs.current.attemptSeq,
          captchaId: recognizeResult.captchaId,
          points: recognizeResult.points,
          message: recognizeResult.message,
          elapsedMs: recognizeResult.elapsed,
        };

        // Bypass 记录
        bypass = {
          bypassType: strategy.type,
          success: bypassResult.success,
          message: bypassResult.message,
        };

        // 资产记录（从 collector 获取）
        const captures = collector.getArgs().captures;
        if (Object.keys(captures).length > 0) {
          assets = [];
          for (const assetType of Object.keys(captures)) {
            assets.push({
              assetType: assetType as AssetRecord["assetType"],
              r2Key: `captchas/${task.provider}/${task.type}/${task.containerId}/${assetType}.png`,
            });
          }
        }
      }

      const geetestId = adapter.getGeetestId(task);

      try {
        // 提交到上游服务器（原有逻辑）
        const response = await captchaTaskApi.submitResult({
          taskId: task.taskId,
          status: resultStatus,
          duration,
          result: extra?.result,
          errorMessage: extra?.errorMessage,
          challenge: task.challenge,
          geetestId,
          provider: task.provider,
          captchaType: task.type,
          riskType: task.riskType,
        });
        if (response.success) {
          logger.info(`任务结果已上报: ${task.taskId} (${resultStatus})`);
        } else {
          logger.error(`任务结果上报失败: ${response.message}`);
        }

        // 提交详细记录到统计服务器（新增逻辑）
        const detailedResponse = await captchaTaskApi.submitTaskDetailed({
          taskId: task.taskId,
          status: resultStatus,
          result: extra?.result,
          duration,
          recognition,
          bypass,
          assets,
          challenge: task.challenge,
          geetestId,
          provider: task.provider,
          captchaType: task.type,
          riskType: task.riskType,
        });
        if (detailedResponse.success) {
          logger.info(`详细任务结果已上报: ${task.taskId}`);
        } else {
          logger.error(`详细任务结果上报失败: ${detailedResponse.error}`);
        }
      } catch (err) {
        logger.error("上报任务结果异常:", err);
      }
    },
    [task, collector, strategy.type, adapter],
  );

  // Auto solve
  const autoSolveCaptcha = useCallback(async (): Promise<string> => {
    const parentContainer = document.getElementById(task.containerId);
    if (!parentContainer) throw new Error("未找到外部容器");

    collector.reset();

    // 增加尝试序号
    refs.current.attemptSeq += 1;

    // Wait for animation/render
    await new Promise((resolve) => setTimeout(resolve, delays.screenshot));

    // Delegate solving to the strategy
    const solveResult = await strategy.solve({
      container: parentContainer,
      containerId: task.containerId,
      collector,
    });

    // Save full result
    refs.current.solveResult = solveResult;
    return solveResult.recognizeResult.captchaId;
  }, [task.containerId, strategy, collector, delays.screenshot]);

  // Handle successful validation (Front-end)
  const handleSuccess = useCallback(async () => {
    const captcha = refs.current.captcha;
    if (!captcha) return;

    const result = captcha.getValidate();
    if (!result) return;

    logger.log(`GeeTest ${adapter.version} 验证成功`);

    // 上报结果到服务器
    await submitTaskResult("success", { result });

    // Collect and Upload Data
    collector.setMetadata("solver", strategy.type);
    collector.setMetadata("geetestId", adapter.getGeetestId(task));
    collector.setMetadata("challenge", task.challenge);
    collector.setMetadata("riskType", task.riskType);
    collector.setMetadata("validateResult", result);
    if (refs.current.solveResult) {
      collector.setMetadata("solveResult", refs.current.solveResult.recognizeResult);
    }

    uploadCaptchaData({
      ...collector.getArgs(),
      captchaProvider: task.provider,
      captchaType: task.type,
      containerId: task.containerId,
    });

    setStatus("success");
    setStatusMessage("验证成功");
    onComplete?.();
  }, [task, collector, onComplete, strategy.type, submitTaskResult, adapter]);

  // Handle validation failure with retry logic
  const handleFail = useCallback(
    async (err: GeeTestError) => {
      logger.error(`GeeTest ${adapter.version} validation failed:`, err);

      // Retry logic
      if (refs.current.retryCount < maxRetryCount) {
        refs.current.retryCount += 1;
        const retryNum = refs.current.retryCount;
        setStatus("retrying");
        setStatusMessage(
          `验证失败，正在重试 (${retryNum}/${maxRetryCount})...`,
        );

        setTimeout(async () => {
          try {
            setStatus("solving");
            setStatusMessage(`识别中 (重试 ${retryNum}/${maxRetryCount})...`);
            refs.current.recognitionId = await autoSolveCaptcha();
          } catch (error) {
            logger.error("识别失败:", getErrorMessage(error, "识别失败"));
            setStatus("error");
            setStatusMessage(getErrorMessage(error, "识别失败"));
            await submitTaskResult("error", {
              errorMessage: getErrorMessage(error, "识别失败"),
            });
            onComplete?.();
          }
        }, delays.retryWait);
      } else {
        const errorMessage = err.msg || "已达最大重试次数";
        setStatus("error");
        setStatusMessage(`验证失败: ${errorMessage}`);
        refs.current.retryCount = 0;
        await submitTaskResult("failed", { errorMessage });
        onComplete?.();
      }
    },
    [autoSolveCaptcha, onComplete, maxRetryCount, delays.retryWait, submitTaskResult, adapter.version],
  );

  // Handle GeeTest error
  const handleError = useCallback(
    async (err: GeeTestError) => {
      logger.error(`GeeTest ${adapter.version} error:`, err);
      setLoadError(err.msg || "Unknown error");
      await submitTaskResult("error", {
        errorMessage: err.msg || "Unknown error",
      });
      onComplete?.();
    },
    [onComplete, submitTaskResult, adapter.version],
  );

  // Handle captcha ready
  const handleReady = useCallback(() => {
    setIsLoading(false);
    refs.current.retryCount = 0;
    refs.current.attemptSeq = 0;

    if (!containerRef.current) return;

    setTimeout(() => {
      if (!containerRef.current) return;
      autoClickCaptchaButton(containerRef.current);

      setTimeout(async () => {
        try {
          setStatus("solving");
          setStatusMessage("识别中...");
          refs.current.recognitionId = await autoSolveCaptcha();
        } catch (error) {
          logger.error("识别失败:", getErrorMessage(error, "识别失败"));
          setStatus("error");
          setStatusMessage(getErrorMessage(error, "识别失败"));
          await submitTaskResult("error", {
            errorMessage: getErrorMessage(error, "识别失败"),
          });
          onComplete?.();
        }
      }, delays.imageLoad);
    }, delays.autoClick);
  }, [autoSolveCaptcha, onComplete, delays.autoClick, delays.imageLoad, submitTaskResult]);

  // Handle captcha close
  const handleClose = useCallback(() => {
    setStatus("idle");
    setStatusMessage("");
  }, []);

  // 使用 ref 保存回调，避免回调变化导致验证码重新初始化
  const handleReadyRef = useRef(handleReady);
  const handleSuccessRef = useRef(handleSuccess);
  const handleFailRef = useRef(handleFail);
  const handleErrorRef = useRef(handleError);
  const handleCloseRef = useRef(handleClose);
  handleReadyRef.current = handleReady;
  handleSuccessRef.current = handleSuccess;
  handleFailRef.current = handleFail;
  handleErrorRef.current = handleError;
  handleCloseRef.current = handleClose;

  // Initialize captcha - 只在关键字段变化时重新初始化
  const effectDeps = adapter.getEffectDeps(task);

  useEffect(() => {
    let isMounted = true;
    const currentRefs = refs.current;

    const initCaptcha = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        await adapter.loadScript();

        if (!isMounted || !containerRef.current) return;

        console.log(`Initializing GeeTest ${adapter.version} for task:`, task.taskId);

        adapter.initCaptcha(
          task,
          (err: GeeTestError) => handleErrorRef.current(err),
          (captcha: GeeTestInstance) => {
            if (!isMounted) {
              captcha.destroy();
              return;
            }

            currentRefs.captcha = captcha;

            captcha
              .onReady(() => handleReadyRef.current())
              .onSuccess(() => handleSuccessRef.current())
              .onFail((err: GeeTestError) => handleFailRef.current(err))
              .onError((err: GeeTestError) => handleErrorRef.current(err))
              .onClose(() => handleCloseRef.current());

            captcha.appendTo(`#${innerContainerId.current}`);
          },
        );
      } catch (err) {
        if (isMounted) {
          setLoadError(getErrorMessage(err, `Failed to initialize GeeTest ${adapter.version}`));
          setIsLoading(false);
          logger.error(`GeeTest ${adapter.version} initialization error:`, err);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, effectDeps);

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
    </div>
  );
}

export default GeetestCaptcha;
