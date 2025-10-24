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

/**
 * 结构化日志条目接口
 */
export interface StructuredLogEntry extends LogEntry {
  /** 操作类型 */
  operation?: string;
  /** 包名 */
  packageName?: string;
  /** 操作持续时间（毫秒） */
  duration?: number;
  /** 操作状态 */
  status?: 'started' | 'completed' | 'failed' | 'skipped';
  /** 错误信息 */
  error?: string;
  /** 额外的元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 敏感信息过滤配置
 */
export interface SensitiveDataFilter {
  /** 需要过滤的字段名模式 */
  fieldPatterns: string[];
  /** 需要过滤的值模式 */
  valuePatterns: RegExp[];
  /** 替换文本 */
  replacement: string;
}

/**
 * 扩展的日志配置接口
 */
export interface ExtendedLoggerConfig extends LoggerConfig {
  /** 是否启用结构化日志 */
  enableStructuredLogging?: boolean;
  /** 是否启用敏感信息过滤 */
  enableSensitiveDataFilter?: boolean;
  /** 自定义敏感信息过滤配置 */
  sensitiveDataFilter?: SensitiveDataFilter;
  /** 是否记录操作持续时间 */
  enableDurationTracking?: boolean;
  /** 最大日志条目长度 */
  maxLogEntryLength?: number;
}
