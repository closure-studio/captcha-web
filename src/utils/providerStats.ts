/**
 * Provider 识别耗时统计
 */

export interface ProviderStatsEntry {
  provider: string;
  totalElapsed: number;
  count: number;
  avg: number;
  min: number;
  max: number;
  last: number;
}

interface StatsRecord {
  totalElapsed: number;
  count: number;
  min: number;
  max: number;
  last: number;
}

const statsMap = new Map<string, StatsRecord>();

// 变更通知回调
type Listener = () => void;
const listeners = new Set<Listener>();

export function recordElapsed(provider: string, elapsed: number): void {
  const existing = statsMap.get(provider);
  if (existing) {
    existing.totalElapsed += elapsed;
    existing.count += 1;
    existing.min = Math.min(existing.min, elapsed);
    existing.max = Math.max(existing.max, elapsed);
    existing.last = elapsed;
  } else {
    statsMap.set(provider, {
      totalElapsed: elapsed,
      count: 1,
      min: elapsed,
      max: elapsed,
      last: elapsed,
    });
  }
  listeners.forEach((fn) => fn());
}

export function getProviderStats(): ProviderStatsEntry[] {
  return Array.from(statsMap.entries()).map(([provider, record]) => ({
    provider,
    totalElapsed: record.totalElapsed,
    count: record.count,
    avg: Math.round(record.totalElapsed / record.count),
    min: record.min,
    max: record.max,
    last: record.last,
  }));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
