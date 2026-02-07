import { useEffect, useState } from "react";
import { MAX_COUNT_PER_PROVIDER } from "../consts/consts";
import type { CaptchaResultStatus } from "../types/api";

// ============ Module-level stores ============

export interface ProviderStatsEntry {
  provider: string;
  count: number;
  avg: number;
  min: number;
  max: number;
}

const providerStatsMap = new Map<
  string,
  { totalElapsed: number; count: number; min: number; max: number }
>();

export function recordElapsed(provider: string, elapsed: number): void {
  const existing = providerStatsMap.get(provider);
  if (existing && existing.count < MAX_COUNT_PER_PROVIDER) {
    existing.totalElapsed += elapsed;
    existing.count += 1;
    existing.min = Math.min(existing.min, elapsed);
    existing.max = Math.max(existing.max, elapsed);
  } else {
    providerStatsMap.set(provider, {
      totalElapsed: elapsed,
      count: 1,
      min: elapsed,
      max: elapsed,
    });
  }
}

export interface CaptchaStatsData {
  total: number;
  success: number;
  failed: number;
  timeout: number;
  error: number;
  avgDuration: number;
}

const captchaStats = {
  success: 0,
  failed: 0,
  timeout: 0,
  error: 0,
  totalDuration: 0,
  count: 0,
};

export function recordCaptchaResult(
  status: CaptchaResultStatus,
  duration?: number,
): void {
  switch (status) {
    case "success":
      captchaStats.success += 1;
      break;
    case "failed":
      captchaStats.failed += 1;
      break;
    case "timeout":
      captchaStats.timeout += 1;
      break;
    case "error":
      captchaStats.error += 1;
      break;
  }
  if (duration !== undefined && status !== "timeout") {
    captchaStats.totalDuration += duration;
    captchaStats.count += 1;
  }
}

// ============ System Info ============

declare const __APP_VERSION__: string;

export interface SystemInfoData {
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

export interface SystemInfoContextValue {
  system: SystemInfoData;
  providerStats: ProviderStatsEntry[];
  captchaStats: CaptchaStatsData;
}

function collect(): SystemInfoContextValue {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
  };
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number };
  };

  const system: SystemInfoData = {
    version: __APP_VERSION__,
    cpuCores: navigator.hardwareConcurrency || 0,
    deviceMemory: nav.deviceMemory ?? null,
    jsHeapUsed: perf.memory?.usedJSHeapSize ?? null,
    jsHeapTotal: perf.memory?.totalJSHeapSize ?? null,
    online: navigator.onLine,
    networkType: nav.connection?.effectiveType ?? null,
    networkSpeed: nav.connection?.downlink ?? null,
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
    dpr: window.devicePixelRatio,
  };

  const providerStats = Array.from(providerStatsMap.entries()).map(
    ([provider, r]) => ({
      provider,
      count: r.count,
      avg: Math.round(r.totalElapsed / r.count),
      min: r.min,
      max: r.max,
    }),
  );

  const total =
    captchaStats.success +
    captchaStats.failed +
    captchaStats.timeout +
    captchaStats.error;

  return {
    system,
    providerStats,
    captchaStats: {
      total,
      success: captchaStats.success,
      failed: captchaStats.failed,
      timeout: captchaStats.timeout,
      error: captchaStats.error,
      avgDuration:
        captchaStats.count > 0
          ? Math.round(captchaStats.totalDuration / captchaStats.count)
          : 0,
    },
  };
}

// ============ Hook ============

export function useSystemInfoManager(): SystemInfoContextValue {
  const [state, setState] = useState<SystemInfoContextValue>(collect);

  useEffect(() => {
    const interval = setInterval(() => setState(collect()), 1000);
    return () => clearInterval(interval);
  }, []);

  return state;
}
