/**
 * Logger utility that wraps console methods
 * In production environment, all logging is disabled to prevent memory leaks
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

// Check if we're in production environment
// Uses Vite's MODE or custom VITE_ENV environment variable
const isProd = (): boolean => {
  const isProdEnv = import.meta.env.IS_PROD;
  return isProdEnv === true || isProdEnv === "true";
};

// No-op function for production
const noop = (): void => {};

/**
 * Creates a logger instance with configurable options
 * In production, returns a logger with all methods as no-ops
 */
const createLogger = (config: LoggerConfig = {}) => {
  const { minLevel = "debug", prefix = "[App]" } = config;
  const minLevelPriority = LOG_LEVELS[minLevel];

  // In production, return a logger with all methods as no-ops
  if (isProd()) {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
      log: noop,
      table: noop,
      group: noop,
      groupEnd: noop,
      time: noop,
      timeEnd: noop,
      trace: noop,
      dir: noop,
      assert: noop,
    };
  }

  // Development logger with full functionality
  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= minLevelPriority;
  };

  const formatArgs = (args: unknown[]): unknown[] => {
    if (prefix && args.length > 0 && typeof args[0] === "string") {
      return [`${prefix} ${args[0]}`, ...args.slice(1)];
    }
    return prefix ? [prefix, ...args] : args;
  };

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog("debug")) {
        console.debug(...formatArgs(args));
      }
    },
    info: (...args: unknown[]) => {
      if (shouldLog("info")) {
        console.info(...formatArgs(args));
      }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog("warn")) {
        console.warn(...formatArgs(args));
      }
    },
    error: (...args: unknown[]) => {
      if (shouldLog("error")) {
        console.error(...formatArgs(args));
      }
    },
    log: (...args: unknown[]) => {
      if (shouldLog("debug")) {
        console.log(...formatArgs(args));
      }
    },
    table: (data: unknown, columns?: string[]) => {
      if (shouldLog("debug")) {
        console.table(data, columns);
      }
    },
    group: (...args: unknown[]) => {
      if (shouldLog("debug")) {
        console.group(...formatArgs(args));
      }
    },
    groupEnd: () => {
      if (shouldLog("debug")) {
        console.groupEnd();
      }
    },
    time: (label: string) => {
      if (shouldLog("debug")) {
        console.time(`${prefix} ${label}`);
      }
    },
    timeEnd: (label: string) => {
      if (shouldLog("debug")) {
        console.timeEnd(`${prefix} ${label}`);
      }
    },
    trace: (...args: unknown[]) => {
      if (shouldLog("debug")) {
        console.trace(...formatArgs(args));
      }
    },
    dir: (obj: unknown, options?: object) => {
      if (shouldLog("debug")) {
        console.dir(obj, options);
      }
    },
    assert: (condition: boolean, ...args: unknown[]) => {
      if (shouldLog("error")) {
        console.assert(condition, ...formatArgs(args));
      }
    },
  };
};

// Default logger instance
const logger = createLogger();

// Named module loggers for different parts of the application
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
  type LogLevel,
  type LoggerConfig,
};
export default logger;
