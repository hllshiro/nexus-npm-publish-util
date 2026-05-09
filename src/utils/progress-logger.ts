/**
 * 进度条日志适配器
 * 在进度条运行期间将日志输出重定向到进度条的log方法
 */

import { Logger } from './logger.ts';
import { LogLevel } from '@/types/index.ts';
import chalk from 'chalk';
import type { ProgressBar } from './progress-bar.ts';

/**
 * 进度条日志适配器类
 * 提供在进度条运行期间安全输出日志的功能
 */
export class ProgressLogger {
  private originalLogger: Logger;
  private progressBar: ProgressBar | null = null;
  private isProgressMode: boolean = false;

  constructor(logger: Logger) {
    this.originalLogger = logger;
  }

  /**
   * 设置进度条实例并启用进度模式
   */
  setProgressBar(progressBar: ProgressBar): void {
    this.progressBar = progressBar;
    this.isProgressMode = true;
  }

  /**
   * 清除进度条并禁用进度模式
   */
  clearProgressBar(): void {
    this.progressBar = null;
    this.isProgressMode = false;
  }

  /**
   * 格式化日志消息为进度条兼容格式
   * chalk 自动检测颜色支持
   */
  private formatProgressMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = this.formatTimestamp();
    const levelText = LogLevel[level].padEnd(5, ' ');
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    const baseMessage = `[${timestamp}][${levelText}] ${message}${dataStr}`;

    switch (level) {
      case LogLevel.DEBUG:
        return chalk.gray(baseMessage);
      case LogLevel.INFO:
        return chalk.cyan(baseMessage);
      case LogLevel.WARN:
        return chalk.yellow(baseMessage);
      case LogLevel.ERROR:
        return chalk.red(baseMessage);
      default:
        return baseMessage;
    }
  }

  private formatTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}:${milliseconds}`;
  }

  private writeLog(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.originalLogger.getLevel()) {
      return;
    }

    if (this.isProgressMode && this.progressBar && this.progressBar.isRunning()) {
      const formattedMessage = this.formatProgressMessage(level, message, data);
      this.progressBar.log(formattedMessage);
    } else {
      switch (level) {
        case LogLevel.DEBUG:
          this.originalLogger.debug(message, data);
          break;
        case LogLevel.INFO:
          this.originalLogger.info(message, data);
          break;
        case LogLevel.WARN:
          this.originalLogger.warn(message, data);
          break;
        case LogLevel.ERROR:
          this.originalLogger.error(message, data);
          break;
      }
    }
  }

  debug(message: string, data?: unknown): void {
    this.writeLog(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.writeLog(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.writeLog(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.writeLog(LogLevel.ERROR, message, data);
  }

  setLevel(level: LogLevel): void {
    this.originalLogger.setLevel(level);
  }

  getLevel(): LogLevel {
    return this.originalLogger.getLevel();
  }

  isInProgressMode(): boolean {
    return this.isProgressMode && this.progressBar?.isRunning() === true;
  }
}

/**
 * 创建进度条日志适配器
 */
export function createProgressLogger(logger: Logger): ProgressLogger {
  return new ProgressLogger(logger);
}
