/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  level: LogLevel;
  logFile?: string;
  enableConsole: boolean;
  enableFile: boolean;
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
}
