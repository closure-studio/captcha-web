/**
 * Logger utility that wraps console methods
 * - 开发环境 (localhost/127.0.0.1) 默认启用日志
 * - 生产环境默认禁用日志，可通过 enableLogging() 动态开启
 * - 禁用时会静默全局 console，防止第三方库输出
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  /** Minimum log level to output */
  minLevel?: LogLevel;
  /** Custom prefix for all log messages */
  prefix?: string;
}

// Log level priority for filtering
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 保存原始 console 方法
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
  table: console.table.bind(console),
  group: console.group.bind(console),
  groupEnd: console.groupEnd.bind(console),
  time: console.time.bind(console),
  timeEnd: console.timeEnd.bind(console),
  trace: console.trace.bind(console),
  dir: console.dir.bind(console),
  assert: console.assert.bind(console),
  clear: console.clear.bind(console),
};

// No-op function
const noop = (): void => {};

// 日志开关状态
let loggingEnabled: boolean | null = null;

/**
 * 检测当前是否为开发环境
 */
const isDevEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost")
  );
};

/**
 * 获取当前日志启用状态
 */
const isLoggingEnabled = (): boolean => {
  if (loggingEnabled !== null) {
    return loggingEnabled;
  }
  return isDevEnvironment();
};

/**
 * 覆盖全局 console，根据状态决定是否静默
 */
const applyConsoleOverride = (): void => {
  if (isLoggingEnabled()) {
    // 恢复原始 console
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    console.table = originalConsole.table;
    console.group = originalConsole.group;
    console.groupEnd = originalConsole.groupEnd;
    console.time = originalConsole.time;
    console.timeEnd = originalConsole.timeEnd;
    console.trace = originalConsole.trace;
    console.dir = originalConsole.dir;
    console.assert = originalConsole.assert;
  } else {
    // 静默所有 console 输出
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;
    console.debug = noop;
    console.table = noop;
    console.group = noop;
    console.groupEnd = noop;
    console.time = noop;
    console.timeEnd = noop;
    console.trace = noop;
    console.dir = noop;
    console.assert = noop;
  }
};

/**
 * 动态启用日志输出
 */
const enableLogging = (): void => {
  loggingEnabled = true;
  applyConsoleOverride();
};

/**
 * 动态禁用日志输出
 */
const disableLogging = (): void => {
  loggingEnabled = false;
  applyConsoleOverride();
};

/**
 * 重置为默认行为（根据域名自动判断）
 */
const resetLogging = (): void => {
  loggingEnabled = null;
  applyConsoleOverride();
};

// 初始化时应用一次
applyConsoleOverride();

/**
 * 创建 logger 实例
 * 始终使用 originalConsole 以确保在启用时能正常输出
 */
const createLogger = (config: LoggerConfig = {}) => {
  const { minLevel = "debug", prefix = "[App]" } = config;
  const minLevelPriority = LOG_LEVELS[minLevel];

  const shouldLog = (level: LogLevel): boolean => {
    return isLoggingEnabled() && LOG_LEVELS[level] >= minLevelPriority;
  };

  const formatArgs = (args: unknown[]): unknown[] => {
    if (prefix && args.length > 0 && typeof args[0] === "string") {
      return [`${prefix} ${args[0]}`, ...args.slice(1)];
    }
    return prefix ? [prefix, ...args] : args;
  };

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog("debug")) originalConsole.debug(...formatArgs(args));
    },
    info: (...args: unknown[]) => {
      if (shouldLog("info")) originalConsole.info(...formatArgs(args));
    },
    warn: (...args: unknown[]) => {
      if (shouldLog("warn")) originalConsole.warn(...formatArgs(args));
    },
    error: (...args: unknown[]) => {
      if (shouldLog("error")) originalConsole.error(...formatArgs(args));
    },
    log: (...args: unknown[]) => {
      if (shouldLog("debug")) originalConsole.log(...formatArgs(args));
    },
    table: (data: unknown, columns?: string[]) => {
      if (shouldLog("debug")) originalConsole.table(data, columns);
    },
    group: (...args: unknown[]) => {
      if (shouldLog("debug")) originalConsole.group(...formatArgs(args));
    },
    groupEnd: () => {
      if (shouldLog("debug")) originalConsole.groupEnd();
    },
    time: (label: string) => {
      if (shouldLog("debug")) originalConsole.time(`${prefix} ${label}`);
    },
    timeEnd: (label: string) => {
      if (shouldLog("debug")) originalConsole.timeEnd(`${prefix} ${label}`);
    },
    trace: (...args: unknown[]) => {
      if (shouldLog("debug")) originalConsole.trace(...formatArgs(args));
    },
    dir: (obj: unknown, options?: object) => {
      if (shouldLog("debug")) originalConsole.dir(obj, options);
    },
    assert: (condition: boolean, ...args: unknown[]) => {
      if (shouldLog("error")) originalConsole.assert(condition, ...formatArgs(args));
    },
  };
};

// Default logger instance
const logger = createLogger();

// Named module loggers
const createModuleLogger = (
  moduleName: string,
  config?: Omit<LoggerConfig, "prefix">,
) => {
  return createLogger({ ...config, prefix: `[${moduleName}]` });
};

export {
  logger,
  createLogger,
  createModuleLogger,
  enableLogging,
  disableLogging,
  resetLogging,
  isLoggingEnabled,
  originalConsole,
  type LogLevel,
  type LoggerConfig,
};
export default logger;
