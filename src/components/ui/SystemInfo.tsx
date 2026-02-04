import { useEffect, useState } from "react";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import {
  enableLogging,
  disableLogging,
  isLoggingEnabled,
} from "../../utils/logger";
import {
  getProviderStats,
  subscribe,
  type ProviderStatsEntry,
} from "../../utils/providerStats";
import {
  getCaptchaStats,
  subscribeCaptchaStats,
  type CaptchaStatsData,
} from "../../utils/captchaStats";

declare const __APP_VERSION__: string;

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: MemoryInfo;
}

interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
}

interface SystemInfoData {
  version: string;
  cpuCores: number;
  deviceMemory: number | null;
  jsHeapUsed: number | null;
  jsHeapTotal: number | null;
  online: boolean;
  networkType: string | null;
  networkSpeed: number | null;
  language: string;
  screen: string;
  dpr: number;
}

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

function getSystemInfo(): SystemInfoData {
  const perf = performance as PerformanceWithMemory;
  const navMem = navigator as NavigatorWithDeviceMemory;
  const navConn = navigator as NavigatorWithConnection;

  return {
    version: __APP_VERSION__,
    cpuCores: navigator.hardwareConcurrency || 0,
    deviceMemory: navMem.deviceMemory ?? null,
    jsHeapUsed: perf.memory ? perf.memory.usedJSHeapSize : null,
    jsHeapTotal: perf.memory ? perf.memory.totalJSHeapSize : null,
    online: navigator.onLine,
    networkType: navConn.connection?.effectiveType ?? null,
    networkSpeed: navConn.connection?.downlink ?? null,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
    dpr: window.devicePixelRatio,
  };
}

/**
 * 阻止事件冒泡（防止 GeeTest float 模式误判为点击外部关闭）
 */
const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export function SystemInfo() {
  const { refreshCountdown, isPreparingRefresh } = useAutoRefresh();
  const [info, setInfo] = useState<SystemInfoData>(getSystemInfo);
  const [loggingOn, setLoggingOn] = useState(isLoggingEnabled);
  const [providerStats, setProviderStats] =
    useState<ProviderStatsEntry[]>(getProviderStats);
  const [captchaStats, setCaptchaStats] =
    useState<CaptchaStatsData>(getCaptchaStats);

  const handleLoggingToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      enableLogging();
    } else {
      disableLogging();
    }
    setLoggingOn(checked);
  };

  // 每秒更新动态信息（内存、网络状态）
  useEffect(() => {
    const interval = setInterval(() => {
      setInfo(getSystemInfo());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 订阅 provider stats 更新
  useEffect(() => {
    return subscribe(() => setProviderStats(getProviderStats()));
  }, []);

  // 订阅 captcha stats 更新
  useEffect(() => {
    return subscribeCaptchaStats(() => setCaptchaStats(getCaptchaStats()));
  }, []);

  const items: string[] = [
    `CPU ${info.cpuCores}C`,
    info.deviceMemory !== null ? `RAM ~${info.deviceMemory}GB` : null,
    info.jsHeapUsed !== null && info.jsHeapTotal !== null
      ? `Heap ${formatMB(info.jsHeapUsed)}/${formatMB(info.jsHeapTotal)}MB`
      : null,
    `${info.screen} @${info.dpr}x`,
    info.language,
    info.online
      ? info.networkType
        ? `${info.networkType}${info.networkSpeed ? ` ${info.networkSpeed}Mbps` : ""}`
        : "online"
      : "offline",
  ].filter((v): v is string => v !== null);

  return (
    <div className="fixed top-0 left-0 right-0 bg-slate-800 text-slate-300 text-sm px-4 z-50 font-mono">
      {/* 第一行：系统信息 */}
      <div className="flex items-center gap-3 py-1.5 flex-wrap">
        <span className="font-semibold text-white">v{info.version}</span>
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
        <span className={isPreparingRefresh ? "text-yellow-400" : "text-slate-400"}>
          {isPreparingRefresh ? "等待刷新..." : `刷新 ${formatCountdown(refreshCountdown)}`}
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
          <span className={captchaStats.total > 0 ? (captchaStats.success / captchaStats.total >= 0.8 ? "text-green-400" : captchaStats.success / captchaStats.total >= 0.5 ? "text-yellow-400" : "text-red-400") : "text-slate-500"}>
            {captchaStats.total > 0 ? `${((captchaStats.success / captchaStats.total) * 100).toFixed(1)}%` : "-"}
          </span>
        </span>
        <span className="text-slate-600">|</span>
        <span>
          平均耗时{" "}
          <span className="text-blue-400">
            {captchaStats.avgDuration > 0 ? formatTime(captchaStats.avgDuration) : "-"}
          </span>
        </span>
      </div>
    </div>
  );
}
