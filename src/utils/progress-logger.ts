/**
 * 进度条日志适配器
 * 在进度条运行期间将日志输出重定向到进度条的log方法
 */

import { Logger } from './logger.ts';
import { LogLevel } from '@/types/index.ts';
import chalk from 'chalk';
import process from 'node:process';
import os from 'node:os';
import type { ProgressBar } from './progress-bar.ts';

/**
 * 进度条日志适配器类
 * 提供在进度条运行期间安全输出日志的功能
 */
export class ProgressLogger {
  private originalLogger: Logger;
  private progressBar: ProgressBar | null = null;
  private isProgressMode: boolean = false;
  private colorSupport: boolean;

  constructor(logger: Logger) {
    this.originalLogger = logger;
    this.colorSupport = this.supportsColor();
  }

  /**
   * 检测终端是否支持颜色输出
   * 复用Logger中的颜色检测逻辑
   */
  private supportsColor(): boolean {
    const env = process.env;

    // 1. 明确禁用
    if (env.NO_COLOR !== undefined || env.NODE_DISABLE_COLORS !== undefined) {
      return false;
    }

    // 2. 明确启用
    if (env.FORCE_COLOR !== undefined) {
      const val = env.FORCE_COLOR.trim().toLowerCase();
      if (['', '1', 'true'].includes(val)) return true;
      const num = Number(val);
      return !Number.isNaN(num) && num > 0;
    }

    // 3. dumb 终端无颜色能力
    const term = env.TERM?.toLowerCase() ?? '';
    if (term === 'dumb') return false;

    // 4. 明确颜色提示
    if (
      term.includes('color') ||
      term.includes('ansi') ||
      term.includes('xterm') ||
      term.includes('vt100') ||
      term.includes('screen')
    ) {
      return true;
    }

    // 5. COLORTERM 明确提示
    const colorterm = env.COLORTERM?.toLowerCase() ?? '';
    if (colorterm.includes('truecolor') || colorterm.includes('24bit')) return true;
    if (colorterm === 'yes' || colorterm === '1' || colorterm === 'color') return true;

    // 6. Windows 检测
    if (process.platform === 'win32') {
      try {
        if (env.WT_SESSION) return true; // Windows Terminal
        if (env.TERM_PROGRAM === 'vscode') return true; // VSCode terminal
        if (env.ANSICON) return true;
        if (env.ConEmuANSI === 'ON') return true;
        const [major, , build] = os.release().split('.').map(Number);
        if ((major && major > 10) || (major === 10 && build && build >= 14393)) return true;
        return false;
      } catch {
        return false;
      }
    }

    // 7. CI 环境检测
    if (env.CI !== undefined) {
      const colorfulCIs = ['GITHUB_ACTIONS', 'GITLAB_CI', 'TRAVIS', 'CIRCLECI', 'APPVEYOR', 'BUILDKITE'];
      if (colorfulCIs.some((k) => env[k] !== undefined)) {
        return true;
      }
      return false;
    }

    return false;
  }

  /**
   * 设置进度条实例并启用进度模式
   * @param progressBar 进度条实例
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
   * 格式化日志消息为进度条兼容格式（支持彩色输出）
   * @param level 日志级别
   * @param message 消息内容
   * @param data 附加数据
   */
  private formatProgressMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = this.formatTimestamp();
    const levelText = LogLevel[level].padEnd(5, ' ');
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';

    // 构建基础消息
    const baseMessage = `[${timestamp}][${levelText}] ${message}${dataStr}`;

    // 如果支持颜色，应用颜色格式化
    if (this.colorSupport) {
      return this.applyColorFormatting(level, baseMessage);
    }

    return baseMessage;
  }

  /**
   * 根据日志级别应用颜色格式化
   * @param level 日志级别
   * @param message 消息内容
   */
  private applyColorFormatting(level: LogLevel, message: string): string {
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
