import chalk from 'chalk';
import { LogLevel } from '@/types/index.ts';
import type { LoggerConfig, LogEntry } from '@/types/index.ts';

/**
 * 类型安全的日志工具类
 *
 * 颜色支持由 chalk 自动检测（包括 Windows VT 模式启用），无需手动判断。
 * 禁用颜色：设置环境变量 NO_COLOR=1 或 FORCE_COLOR=0
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
   * 格式化时间戳为 HH:mm:SS:mmm 格式
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
    const paddedLevel = entry.level.padEnd(5, ' ');
    return `[${entry.timestamp}][${paddedLevel}] ${entry.message}${dataStr}`;
  }

  /**
   * 根据日志级别应用颜色格式化
   * chalk 内部自动检测终端颜色支持（包括 Windows CMD VT 模式）
   */
  private formatColoredMessage(level: LogLevel, message: string): string {
    switch (level) {
      case LogLevel.DEBUG:
        return chalk.gray(message);
      case LogLevel.INFO:
        return chalk.cyan(message);
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
    if (level < this.config.level) {
      return;
    }

    const entry = this.createLogEntry(level, message, data);
    const formattedMessage = this.formatMessage(entry);
    const displayMessage = this.formatColoredMessage(level, formattedMessage);

    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(displayMessage);
          break;
        case LogLevel.INFO:
          console.info(displayMessage);
          break;
        case LogLevel.WARN:
          console.warn(displayMessage);
          break;
        case LogLevel.ERROR:
          console.error(displayMessage);
          break;
      }
    }
  }

  public debug(message: string, data?: unknown): void {
    this.writeLog(LogLevel.DEBUG, message, data);
  }

  public info(message: string, data?: unknown): void {
    this.writeLog(LogLevel.INFO, message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.writeLog(LogLevel.WARN, message, data);
  }

  public error(message: string, data?: unknown): void {
    this.writeLog(LogLevel.ERROR, message, data);
  }

  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  public getLevel(): LogLevel {
    return this.config.level;
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
