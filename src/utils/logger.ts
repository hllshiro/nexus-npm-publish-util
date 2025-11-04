import chalk from 'chalk';
import { LogLevel } from '@/types';
import type { LoggerConfig, LogEntry } from '@/types';

/**
 * 类型安全的日志工具类
 */
export class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      ...config,
    };
  }

  /**
   * 格式化时间戳为 HH:mm:SS 格式
   */
  private formatTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}:${milliseconds}`;
  }

  /**
   * 创建日志条目
   */
  private createLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      timestamp: this.formatTimestamp(),
      level: LogLevel[level],
      message,
      data,
    };
  }

  /**
   * 格式化日志消息为 [HH:mm:SS][LEVEL] 内容 格式，确保LEVEL对齐
   */
  private formatMessage(entry: LogEntry): string {
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    // 将LEVEL填充到5个字符，右对齐
    const paddedLevel = entry.level.padEnd(5, ' ');
    return `[${entry.timestamp}][${paddedLevel}] ${entry.message}${dataStr}`;
  }

  /**
   * 根据日志级别应用颜色格式化
   */
  private formatColoredMessage(level: LogLevel, message: string): string {
    switch (level) {
      case LogLevel.DEBUG:
        return chalk.gray(message);
      case LogLevel.INFO:
        return chalk.cyan(message); // 使用青色，比蓝色更清晰
      case LogLevel.WARN:
        return chalk.yellow(message);
      case LogLevel.ERROR:
        return chalk.red(message);
      default:
        return message;
    }
  }

  /**
   * 写入日志
   */
  private writeLog(level: LogLevel, message: string, data?: unknown): void {
    // 检查日志级别
    if (level < this.config.level) {
      return;
    }

    const entry = this.createLogEntry(level, message, data);
    const formattedMessage = this.formatMessage(entry);
    const coloredMessage = this.formatColoredMessage(level, formattedMessage);

    // 控制台输出
    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(coloredMessage);
          break;
        case LogLevel.INFO:
          console.info(coloredMessage);
          break;
        case LogLevel.WARN:
          console.warn(coloredMessage);
          break;
        case LogLevel.ERROR:
          console.error(coloredMessage);
          break;
      }
    }
  }

  /**
   * 调试级别日志
   */
  public debug(message: string, data?: unknown): void {
    this.writeLog(LogLevel.DEBUG, message, data);
  }

  /**
   * 信息级别日志
   */
  public info(message: string, data?: unknown): void {
    this.writeLog(LogLevel.INFO, message, data);
  }

  /**
   * 警告级别日志
   */
  public warn(message: string, data?: unknown): void {
    this.writeLog(LogLevel.WARN, message, data);
  }

  /**
   * 错误级别日志
   */
  public error(message: string, data?: unknown): void {
    this.writeLog(LogLevel.ERROR, message, data);
  }
}

/**
 * 默认日志实例 - 仅输出到控制台
 */
export const logger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false,
});
