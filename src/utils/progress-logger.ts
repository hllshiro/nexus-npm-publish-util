/**
 * 进度条日志适配器
 * 在进度条运行期间将日志输出重定向到进度条的log方法
 */

import { Logger } from './logger.ts';
import type { EnhancedProgressBar } from './progress-bar-enhanced.ts';
import { LogLevel } from '@/types/index.ts';

/**
 * 进度条日志适配器类
 * 提供在进度条运行期间安全输出日志的功能
 */
export class ProgressLogger {
  private originalLogger: Logger;
  private progressBar: EnhancedProgressBar | null = null;
  private isProgressMode: boolean = false;

  constructor(logger: Logger) {
    this.originalLogger = logger;
  }

  /**
   * 设置进度条实例并启用进度模式
   * @param progressBar 进度条实例
   */
  setProgressBar(progressBar: EnhancedProgressBar): void {
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
   * @param level 日志级别
   * @param message 消息内容
   * @param data 附加数据
   */
  private formatProgressMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = this.formatTimestamp();
    const levelText = LogLevel[level].padEnd(5, ' ');
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}][${levelText}] ${message}${dataStr}`;
  }

  /**
   * 格式化时间戳
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
   * 输出日志消息
   * @param level 日志级别
   * @param message 消息内容
   * @param data 附加数据
   */
  private writeLog(level: LogLevel, message: string, data?: unknown): void {
    // 检查日志级别
    if (level < this.originalLogger.getLevel()) {
      return;
    }

    if (this.isProgressMode && this.progressBar && this.progressBar.isRunning()) {
      // 进度条模式：使用进度条的log方法
      const formattedMessage = this.formatProgressMessage(level, message, data);
      this.progressBar.log(formattedMessage);
    } else {
      // 普通模式：使用原始日志器
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

  /**
   * 调试级别日志
   */
  debug(message: string, data?: unknown): void {
    this.writeLog(LogLevel.DEBUG, message, data);
  }

  /**
   * 信息级别日志
   */
  info(message: string, data?: unknown): void {
    this.writeLog(LogLevel.INFO, message, data);
  }

  /**
   * 警告级别日志
   */
  warn(message: string, data?: unknown): void {
    this.writeLog(LogLevel.WARN, message, data);
  }

  /**
   * 错误级别日志
   */
  error(message: string, data?: unknown): void {
    this.writeLog(LogLevel.ERROR, message, data);
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.originalLogger.setLevel(level);
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.originalLogger.getLevel();
  }

  /**
   * 检查是否处于进度模式
   */
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
