import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { dirname, join, extname, basename } from 'path';
import { LogLevel } from '@/types/index.js';
import type { LoggerConfig, LogEntry } from '@/types/index.js';

/**
 * 类型安全的日志工具类
 */
export class Logger {
  private config: LoggerConfig;
  private static sharedLogFile: string | undefined;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      ...config,
    };

    // 如果启用文件日志且指定了日志文件路径，确保目录存在并生成时间戳文件名
    if (this.config.enableFile && this.config.logFile) {
      // 如果已经有共享的日志文件，使用它；否则生成新的
      if (Logger.sharedLogFile) {
        this.config.logFile = Logger.sharedLogFile;
      } else {
        this.config.logFile = this.generateTimestampedLogFile(this.config.logFile);
        Logger.sharedLogFile = this.config.logFile;
      }
      this.ensureLogDirectory();
      this.cleanupOldLogFiles();
    }
  }

  /**
   * 生成带时间戳的日志文件名
   */
  private generateTimestampedLogFile(originalPath: string): string {
    const dir = dirname(originalPath);
    const ext = extname(originalPath);
    const name = basename(originalPath, ext);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    return join(dir, `${name}_${timestamp}${ext}`);
  }

  /**
   * 清理旧的日志文件，保持最多10个文件
   */
  private cleanupOldLogFiles(): void {
    if (!this.config.logFile) return;

    const logDir = dirname(this.config.logFile);
    const originalName = basename(this.config.logFile).split('_')[0] || 'app';
    const ext = extname(this.config.logFile);

    try {
      if (!existsSync(logDir)) return;

      const files = readdirSync(logDir)
        .filter((file) => file.startsWith(originalName) && file.endsWith(ext))
        .map((file) => ({
          name: file,
          path: join(logDir, file),
          mtime: statSync(join(logDir, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // 删除超过10个的旧文件
      if (files.length > 10) {
        files.slice(10).forEach((file) => {
          try {
            unlinkSync(file.path);
          } catch (error) {
            console.error(`Failed to delete old log file ${file.name}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    if (!this.config.logFile) return;

    const logDir = dirname(this.config.logFile);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
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
   * 格式化日志消息
   */
  private formatMessage(entry: LogEntry): string {
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    return `[${entry.timestamp}] ${entry.level}: ${entry.message}${dataStr}`;
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

    // 控制台输出
    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    }

    // 文件输出
    if (this.config.enableFile && this.config.logFile) {
      try {
        appendFileSync(this.config.logFile, formattedMessage + '\n', 'utf8');
      } catch (error) {
        console.error('Failed to write to log file:', error);
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
 * 默认日志实例 - 同时输出到控制台和文件
 */
export const logger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: true,
  logFile: 'logs/app.log',
});

/**
 * 文件专用日志实例 - 仅输出到文件
 * 使用相同的日志文件路径，确保两个实例写入同一个文件
 */
export const fileLogger = new Logger({
  level: LogLevel.INFO,
  enableConsole: false,
  enableFile: true,
  logFile: 'logs/app.log',
});
