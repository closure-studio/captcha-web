import { useState } from "react";
import { useAppContext } from "../../contexts/appContext";
import {
  disableLogging,
  enableLogging,
  isLoggingEnabled,
} from "../../utils/logger";

function formatTime(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms}ms`;
}

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, "0")}m${seconds.toString().padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}

/**
 * 阻止事件冒泡（防止 GeeTest float 模式误判为点击外部关闭）
 */
const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export function SystemInfo() {
  const {
    system,
    providerStats,
    captchaStats,
    refreshCountdown,
    isPreparingRefresh,
  } = useAppContext();

  const [loggingOn, setLoggingOn] = useState(isLoggingEnabled);

  const handleLoggingToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      enableLogging();
    } else {
      disableLogging();
    }
    setLoggingOn(checked);
  };

  const items: string[] = [
    `CPU ${system.cpuCores}C`,
    system.deviceMemory !== null ? `RAM ~${system.deviceMemory}GB` : null,
    system.jsHeapUsed !== null && system.jsHeapTotal !== null
      ? `Heap ${formatMB(system.jsHeapUsed)}/${formatMB(system.jsHeapTotal)}MB`
      : null,
    `${system.screen} @${system.dpr}x`,
    system.language,
    system.online
      ? system.networkType
        ? `${system.networkType}${system.networkSpeed ? ` ${system.networkSpeed}Mbps` : ""}`
        : "online"
      : "offline",
  ].filter((v): v is string => v !== null);

  return (
    <div className="fixed top-0 left-0 right-0 bg-slate-800 text-slate-300 text-sm px-4 z-50 font-mono">
      {/* 第一行：系统信息 */}
      <div className="flex items-center gap-3 py-1.5 flex-wrap">
        <span className="font-semibold text-white">v{system.version}</span>
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-3">
            <span className="text-slate-600">|</span>
            <span>{item}</span>
          </span>
        ))}
        <span className="text-slate-600">|</span>
        {/* 阻止冒泡防止 GeeTest float 模式关闭 */}
        <label
          className="flex items-center gap-1.5 cursor-pointer select-none"
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          onPointerDown={stopPropagation}
        >
          <input
            type="checkbox"
            checked={loggingOn}
            onChange={handleLoggingToggle}
            className="w-3 h-3 rounded border-slate-500 bg-slate-700 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          <span className={loggingOn ? "text-green-400" : "text-slate-500"}>
            Log
          </span>
        </label>
        {/* 刷新倒计时 */}
        <span className="text-slate-600">|</span>
        <span
          className={isPreparingRefresh ? "text-yellow-400" : "text-slate-400"}
        >
          {isPreparingRefresh
            ? "等待刷新..."
            : `刷新 ${formatCountdown(refreshCountdown)}`}
        </span>
      </div>
      {/* 第二行：Provider Stats */}
      <div className="flex items-center gap-3 py-1.5 border-t border-slate-700">
        <span className="font-semibold text-white">Providers</span>
        {providerStats.map((s) => (
          <span key={s.provider} className="flex items-center gap-3">
            <span className="text-slate-600">|</span>
            <span className="text-blue-400">{s.provider}</span>
            <span>{formatTime(s.avg)}</span>
            <span className="text-slate-500">
              ({formatTime(s.min)}-{formatTime(s.max)}, n={s.count})
            </span>
          </span>
        ))}
      </div>
      {/* 第三行：Captcha Stats */}
      <div className="flex items-center gap-3 py-1.5 border-t border-slate-700">
        <span className="font-semibold text-white">Captcha</span>
        <span className="text-slate-600">|</span>
        <span>
          总计 <span className="text-white">{captchaStats.total}</span>
        </span>
        <span className="text-slate-600">|</span>
        <span>
          成功 <span className="text-green-400">{captchaStats.success}</span>
        </span>
        <span className="text-slate-600">|</span>
        <span>
          失败 <span className="text-red-400">{captchaStats.failed}</span>
        </span>
        <span className="text-slate-600">|</span>
        <span>
          超时 <span className="text-yellow-400">{captchaStats.timeout}</span>
        </span>
        <span className="text-slate-600">|</span>
        <span>
          错误 <span className="text-orange-400">{captchaStats.error}</span>
        </span>
        <span className="text-slate-600">|</span>
        <span>
          成功率{" "}
          <span
            className={
              captchaStats.total > 0
                ? captchaStats.success / captchaStats.total >= 0.8
                  ? "text-green-400"
                  : captchaStats.success / captchaStats.total >= 0.5
                    ? "text-yellow-400"
                    : "text-red-400"
                : "text-slate-500"
            }
          >
            {captchaStats.total > 0
              ? `${((captchaStats.success / captchaStats.total) * 100).toFixed(1)}%`
              : "-"}
          </span>
        </span>
        <span className="text-slate-600">|</span>
        <span>
          平均耗时{" "}
          <span className="text-blue-400">
            {captchaStats.avgDuration > 0
              ? formatTime(captchaStats.avgDuration)
              : "-"}
          </span>
        </span>
      </div>
    </div>
  );
}
