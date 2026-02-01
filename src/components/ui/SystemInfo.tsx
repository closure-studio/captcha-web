import { useEffect, useState } from "react";

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

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
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

export function SystemInfo() {
  const [info, setInfo] = useState<SystemInfoData>(getSystemInfo);

  // 每秒更新动态信息（内存、网络状态）
  useEffect(() => {
    const interval = setInterval(() => {
      setInfo(getSystemInfo());
    }, 1000);
    return () => clearInterval(interval);
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
    <div className="fixed top-0 left-0 right-0 bg-slate-800 text-slate-300 text-xs px-4 py-1.5 flex items-center gap-3 z-50 font-mono">
      <span className="font-semibold text-white">v{info.version}</span>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-3">
          <span className="text-slate-600">|</span>
          <span>{item}</span>
        </span>
      ))}
    </div>
  );
}
