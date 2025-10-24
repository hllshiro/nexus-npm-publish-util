import { Logger } from './logger.js';
import type { ExtendedLoggerConfig, StructuredLogEntry, SensitiveDataFilter } from '../types/logger.js';
import { LogLevel } from '../types/logger.js';
import { appendFileSync } from 'fs';

/**
 * 增强的日志记录器
 * 支持结构化日志、敏感信息过滤和操作跟踪
 */
export class EnhancedLogger {
  private config: Required<ExtendedLoggerConfig>;
  private baseLogger: Logger;
  private operationStartTimes: Map<string, number> = new Map();

  // 默认敏感信息过滤配置
  private static readonly DEFAULT_SENSITIVE_FILTER: SensitiveDataFilter = {
    fieldPatterns: [
      'password',
      'token',
      'auth',
      'key',
      'secret',
      'credential',
      'authorization',
      'bearer',
      'api_key',
      'access_token',
      'refresh_token',
    ],
    valuePatterns: [
      /bearer\s+[^\s]+/gi,
      /token[=:]\s*[^\s,}]+/gi,
      /password[=:]\s*[^\s,}]+/gi,
      /auth[=:]\s*[^\s,}]+/gi,
    ],
    replacement: '***',
  };

  constructor(config: ExtendedLoggerConfig = {}) {
    this.config = {
      level: config.level ?? LogLevel.INFO,
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? false,
      logFile: config.logFile,
      enableStructuredLogging: config.enableStructuredLogging ?? true,
      enableSensitiveDataFilter: config.enableSensitiveDataFilter ?? true,
      enableDurationTracking: config.enableDurationTracking ?? true,
      maxLogEntryLength: config.maxLogEntryLength ?? 5000,
      sensitiveDataFilter: config.sensitiveDataFilter ?? EnhancedLogger.DEFAULT_SENSITIVE_FILTER,
    };

    this.baseLogger = new Logger(this.config);
  }

  /**
   * 记录结构化日志
   * @param level 日志级别
   * @param entry 结构化日志条目
   */
  public logStructured(level: LogLevel, entry: Partial<StructuredLogEntry>): void {
    if (!this.config.enableStructuredLogging) {
      // 如果未启用结构化日志，回退到普通日志
      this.baseLogger.info(entry.message || '');
      return;
    }

    const structuredEntry: StructuredLogEntry = {
      timestamp: this.formatTimestamp(),
      level: LogLevel[level],
      message: entry.message || '',
      operation: entry.operation,
      packageName: entry.packageName,
      duration: entry.duration,
      status: entry.status,
      error: entry.error,
      metadata: entry.metadata,
      data: entry.data,
    };

    // 过滤敏感信息
    if (this.config.enableSensitiveDataFilter) {
      this.filterSensitiveData(structuredEntry);
    }

    // 限制日志条目长度
    this.truncateLogEntry(structuredEntry);

    // 格式化并写入日志
    const formattedMessage = this.formatStructuredMessage(structuredEntry);
    this.writeLogDirect(level, formattedMessage);
  }

  /**
   * 开始操作跟踪
   */
  public startOperation(
    operationId: string,
    operation: string,
    packageName?: string,
    metadata?: Record<string, unknown>
  ): void {
    if (this.config.enableDurationTracking) {
      this.operationStartTimes.set(operationId, Date.now());
    }

    this.logStructured(LogLevel.INFO, {
      message: `开始${operation}`,
      operation,
      packageName,
      status: 'started',
      metadata,
    });
  }

  /**
   * 完成操作跟踪
   */
  public completeOperation(
    operationId: string,
    operation: string,
    packageName?: string,
    metadata?: Record<string, unknown>
  ): void {
    const duration = this.calculateDuration(operationId);

    this.logStructured(LogLevel.INFO, {
      message: `完成${operation}${duration ? ` (耗时: ${duration}ms)` : ''}`,
      operation,
      packageName,
      status: 'completed',
      duration,
      metadata,
    });
  }

  /**
   * 记录操作失败
   */
  public failOperation(
    operationId: string,
    operation: string,
    error: string,
    packageName?: string,
    metadata?: Record<string, unknown>
  ): void {
    const duration = this.calculateDuration(operationId);

    this.logStructured(LogLevel.ERROR, {
      message: `${operation}失败: ${error}${duration ? ` (耗时: ${duration}ms)` : ''}`,
      operation,
      packageName,
      status: 'failed',
      duration,
      error,
      metadata,
    });
  }

  /**
   * 记录操作跳过
   */
  public skipOperation(
    operationId: string,
    operation: string,
    reason: string,
    packageName?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.operationStartTimes.delete(operationId);

    this.logStructured(LogLevel.INFO, {
      message: `跳过${operation}: ${reason}`,
      operation,
      packageName,
      status: 'skipped',
      metadata: { ...metadata, skipReason: reason },
    });
  }

  /**
   * 记录包处理进度
   */
  public logProgress(current: number, total: number, operation: string, packageName?: string): void {
    const percentage = Math.round((current / total) * 100);

    this.logStructured(LogLevel.INFO, {
      message: `进度: ${current}/${total} (${percentage}%) - ${operation}`,
      operation: 'progress',
      packageName,
      metadata: {
        current,
        total,
        percentage,
        currentOperation: operation,
      },
    });
  }

  /**
   * 记录性能指标
   */
  public logMetric(metric: string, value: number, unit: string, metadata?: Record<string, unknown>): void {
    this.logStructured(LogLevel.INFO, {
      message: `性能指标 - ${metric}: ${value} ${unit}`,
      operation: 'metric',
      metadata: {
        metric,
        value,
        unit,
        ...metadata,
      },
    });
  }

  /**
   * 基础日志方法
   */
  public debug(message: string, data?: unknown): void {
    this.baseLogger.debug(message, data);
  }

  public info(message: string, data?: unknown): void {
    this.baseLogger.info(message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.baseLogger.warn(message, data);
  }

  public error(message: string, data?: unknown): void {
    this.baseLogger.error(message, data);
  }

  /**
   * 计算操作持续时间
   */
  private calculateDuration(operationId: string): number | undefined {
    if (!this.config.enableDurationTracking) {
      return undefined;
    }

    const startTime = this.operationStartTimes.get(operationId);
    if (startTime) {
      this.operationStartTimes.delete(operationId);
      return Date.now() - startTime;
    }
    return undefined;
  }

  /**
   * 过滤敏感信息
   */
  private filterSensitiveData(entry: StructuredLogEntry): void {
    const filter = this.config.sensitiveDataFilter;

    // 过滤消息中的敏感信息
    entry.message = this.applySensitiveFilter(entry.message, filter);

    // 过滤错误信息中的敏感信息
    if (entry.error) {
      entry.error = this.applySensitiveFilter(entry.error, filter);
    }

    // 过滤数据对象中的敏感信息
    if (entry.data) {
      entry.data = this.filterObjectSensitiveData(entry.data, filter);
    }

    // 过滤元数据中的敏感信息
    if (entry.metadata) {
      entry.metadata = this.filterObjectSensitiveData(entry.metadata, filter) as Record<string, unknown>;
    }
  }

  /**
   * 应用敏感信息过滤规则到字符串
   */
  private applySensitiveFilter(text: string, filter: SensitiveDataFilter): string {
    let filtered = text;

    // 应用值模式过滤
    filter.valuePatterns.forEach((pattern) => {
      filtered = filtered.replace(pattern, filter.replacement);
    });

    return filtered;
  }

  /**
   * 过滤对象中的敏感数据
   */
  private filterObjectSensitiveData(obj: unknown, filter: SensitiveDataFilter): unknown {
    if (typeof obj !== 'object' || obj === null) {
      if (typeof obj === 'string') {
        return this.applySensitiveFilter(obj, filter);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.filterObjectSensitiveData(item, filter));
    }

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // 检查字段名是否匹配敏感模式
      const isSensitiveField = filter.fieldPatterns.some((pattern) => lowerKey.includes(pattern.toLowerCase()));

      if (isSensitiveField) {
        filtered[key] = filter.replacement;
      } else {
        filtered[key] = this.filterObjectSensitiveData(value, filter);
      }
    }

    return filtered;
  }

  /**
   * 截断过长的日志条目
   */
  private truncateLogEntry(entry: StructuredLogEntry): void {
    const maxLength = this.config.maxLogEntryLength;

    if (entry.message.length > maxLength) {
      entry.message = entry.message.substring(0, maxLength - 10) + '...[截断]';
    }

    if (entry.error && entry.error.length > maxLength) {
      entry.error = entry.error.substring(0, maxLength - 10) + '...[截断]';
    }
  }

  /**
   * 格式化结构化日志消息
   */
  private formatStructuredMessage(entry: StructuredLogEntry): string {
    const parts: string[] = [`[${entry.timestamp}] ${entry.level}: ${entry.message}`];

    if (entry.packageName) {
      parts.push(`[包: ${entry.packageName}]`);
    }

    if (entry.operation) {
      parts.push(`[操作: ${entry.operation}]`);
    }

    if (entry.status) {
      parts.push(`[状态: ${entry.status}]`);
    }

    if (entry.duration !== undefined) {
      parts.push(`[耗时: ${entry.duration}ms]`);
    }

    // 添加元数据（如果存在）
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      parts.push(`[元数据: ${JSON.stringify(entry.metadata)}]`);
    }

    // 添加数据（如果存在且不同于元数据）
    if (entry.data && entry.data !== entry.metadata) {
      parts.push(`[数据: ${JSON.stringify(entry.data)}]`);
    }

    return parts.join(' ');
  }

  /**
   * 直接写入日志
   */
  private writeLogDirect(level: LogLevel, message: string): void {
    // 检查日志级别
    if (level < this.config.level) {
      return;
    }

    // 控制台输出
    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(message);
          break;
        case LogLevel.INFO:
          console.info(message);
          break;
        case LogLevel.WARN:
          console.warn(message);
          break;
        case LogLevel.ERROR:
          console.error(message);
          break;
      }
    }

    // 文件输出
    if (this.config.enableFile && this.config.logFile) {
      try {
        appendFileSync(this.config.logFile, message + '\n', 'utf8');
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }
}

/**
 * 默认的增强日志实例
 */
export const enhancedLogger = new EnhancedLogger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: true,
  logFile: 'logs/app.log',
  enableStructuredLogging: true,
  enableSensitiveDataFilter: true,
  enableDurationTracking: true,
  maxLogEntryLength: 5000,
});

/**
 * 仅文件输出的增强日志实例
 */
export const fileEnhancedLogger = new EnhancedLogger({
  level: LogLevel.INFO,
  enableConsole: false,
  enableFile: true,
  logFile: 'logs/app.log',
  enableStructuredLogging: true,
  enableSensitiveDataFilter: true,
  enableDurationTracking: true,
  maxLogEntryLength: 5000,
});
