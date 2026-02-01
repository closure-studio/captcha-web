/**
 * 通用 UI 组件
 */

// ============ Status Types ============

export type CaptchaStatus = "idle" | "solving" | "validating" | "success" | "error" | "retrying";

interface StatusStyle {
  bg: string;
  text: string;
  spinner?: string;
}

const STATUS_STYLES: Record<Exclude<CaptchaStatus, "idle">, StatusStyle> = {
  solving: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    spinner: "border-blue-500",
  },
  retrying: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    spinner: "border-orange-500",
  },
  validating: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    spinner: "border-amber-500",
  },
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  error: {
    bg: "bg-red-50",
    text: "text-red-700",
  },
};

// ============ Spinner Components ============

interface SpinnerProps {
  /** 自定义类名 */
  className?: string;
  /** 尺寸 */
  size?: "sm" | "md";
}

/**
 * 通用加载动画组件
 */
export const Spinner = ({ className = "", size = "sm" }: SpinnerProps) => {
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div
      className={`${sizeClass} border-2 rounded-full animate-spin border-t-transparent ${className}`}
    />
  );
};

/**
 * 加载状态展示组件
 */
export const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-4 text-slate-500">
    <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-2" />
    <span className="text-sm">加载验证码...</span>
  </div>
);

// ============ Icon Components ============

/**
 * 成功图标
 */
export const SuccessIcon = () => (
  <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
);

/**
 * 错误图标
 */
export const ErrorIcon = () => (
  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

// ============ Error Display Component ============

interface ErrorDisplayProps {
  /** 错误消息 */
  error: string;
  /** 重试按钮文本 */
  retryText?: string;
  /** 重试回调 */
  onRetry?: () => void;
}

/**
 * 错误状态展示组件
 */
export const ErrorDisplay = ({
  error,
  retryText = "重新加载",
  onRetry = () => window.location.reload(),
}: ErrorDisplayProps) => (
  <div className="text-red-500 p-4 text-center text-sm">
    <p>加载失败: {error}</p>
    <button
      onClick={onRetry}
      className="mt-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded hover:bg-slate-700 transition-colors"
    >
      {retryText}
    </button>
  </div>
);

// ============ Status Indicator Component ============

interface StatusIndicatorProps {
  /** 当前状态 */
  status: CaptchaStatus;
  /** 状态消息 */
  message: string;
}

/**
 * 状态指示器组件
 * 根据状态显示对应的样式和图标
 */
export const StatusIndicator = ({ status, message }: StatusIndicatorProps) => {
  if (status === "idle") return null;

  const style = STATUS_STYLES[status];
  const isLoading = status === "solving" || status === "validating" || status === "retrying";

  return (
    <div className="px-6 pb-6">
      <div className={`flex items-center gap-3 p-3 rounded-lg ${style.bg}`}>
        {isLoading && <Spinner className={style.spinner} />}
        {status === "success" && <SuccessIcon />}
        {status === "error" && <ErrorIcon />}
        <span className={`text-sm ${style.text}`}>{message}</span>
      </div>
    </div>
  );
};
