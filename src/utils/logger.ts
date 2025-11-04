import chalk from 'chalk';
import { LogLevel } from '@/types/index.ts';
import type { LoggerConfig, LogEntry } from '@/types/index.ts';
import process from 'node:process';
import os from 'node:os';

/**
 * 类型安全的日志工具类
 */
export class Logger {
  private config: LoggerConfig;
  private colorSupport: boolean;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      ...config,
    };
    this.colorSupport = this.supportsColor();
  }

  /**
   * 检测终端是否支持颜色输出
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

    // 4. 明确颜色提示（256color, truecolor, ansi, xterm 等）
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

    // 6. Windows 检测：仅在确认支持的情况下返回 true
    if (process.platform === 'win32') {
      try {
        // 常见支持环境
        if (env.WT_SESSION) return true; // Windows Terminal
        if (env.TERM_PROGRAM === 'vscode') return true; // VSCode terminal
        if (env.ANSICON) return true;
        if (env.ConEmuANSI === 'ON') return true;
        const [major, , build] = os.release().split('.').map(Number);
        if ((major && major > 10) || (major === 10 && build && build >= 14393)) return true;
        return false; // 没有确凿证据则不支持
      } catch {
        return false; // 无法判断时保守认为不支持
      }
    }

    // 7. CI 环境检测：大多数 CI 不支持颜色，只有特定平台明确支持
    if (env.CI !== undefined) {
      const colorfulCIs = ['GITHUB_ACTIONS', 'GITLAB_CI', 'TRAVIS', 'CIRCLECI', 'APPVEYOR', 'BUILDKITE'];
      if (colorfulCIs.some((k) => env[k] !== undefined)) {
        return true;
      }
      return false;
    }

    // 8. 若无明确证据，不冒险开启
    return false;
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
   * 为不支持颜色的终端添加符号前缀
   * 注意：formatMessage已经包含了级别信息，这里不需要重复添加
   */
  private addLevelSymbol(_level: LogLevel, message: string): string {
    // formatMessage方法已经包含了[LEVEL]格式，不需要重复添加
    return message;
  }

  /**
   * 根据日志级别应用颜色格式化（兼容版本）
   */
  private formatColoredMessage(level: LogLevel, message: string): string {
    // 如果不支持颜色，直接返回原始消息
    if (!this.colorSupport) {
      return message;
    }

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
   * 根据日志级别应用格式化（完全兼容版本）
   */
  private formatDisplayMessage(level: LogLevel, message: string): string {
    let formattedMessage = message;

    // 添加符号（不支持颜色时）
    formattedMessage = this.addLevelSymbol(level, formattedMessage);

    // 应用颜色（支持颜色时）
    formattedMessage = this.formatColoredMessage(level, formattedMessage);

    return formattedMessage;
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
    const displayMessage = this.formatDisplayMessage(level, formattedMessage);

    // 控制台输出
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

  /**
   * 设置日志级别
   */
  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 获取当前日志级别
   */
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
