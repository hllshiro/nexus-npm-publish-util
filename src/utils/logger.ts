import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { LogLevel } from '../types/logger.js'
import type { LoggerConfig, LogEntry } from '../types/logger.js'

/**
 * 类型安全的日志工具类
 */
export class Logger {
  private config: LoggerConfig
  private static instance: Logger

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      ...config
    }

    // 如果启用文件日志且指定了日志文件路径，确保目录存在
    if (this.config.enableFile && this.config.logFile) {
      this.ensureLogDirectory()
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config)
    }
    return Logger.instance
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    if (!this.config.logFile) return

    const logDir = dirname(this.config.logFile)
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(): string {
    return new Date().toISOString()
  }

  /**
   * 创建日志条目
   */
  private createLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      timestamp: this.formatTimestamp(),
      level: LogLevel[level],
      message,
      data
    }
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(entry: LogEntry): string {
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
    return `[${entry.timestamp}] ${entry.level}: ${entry.message}${dataStr}`
  }

  /**
   * 写入日志
   */
  private writeLog(level: LogLevel, message: string, data?: unknown): void {
    // 检查日志级别
    if (level < this.config.level) {
      return
    }

    const entry = this.createLogEntry(level, message, data)
    const formattedMessage = this.formatMessage(entry)

    // 控制台输出
    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage)
          break
        case LogLevel.INFO:
          console.info(formattedMessage)
          break
        case LogLevel.WARN:
          console.warn(formattedMessage)
          break
        case LogLevel.ERROR:
          console.error(formattedMessage)
          break
      }
    }

    // 文件输出
    if (this.config.enableFile && this.config.logFile) {
      try {
        appendFileSync(this.config.logFile, formattedMessage + '\n', 'utf8')
      } catch (error) {
        console.error('Failed to write to log file:', error)
      }
    }
  }

  /**
   * 调试级别日志
   */
  public debug(message: string, data?: unknown): void {
    this.writeLog(LogLevel.DEBUG, message, data)
  }

  /**
   * 信息级别日志
   */
  public info(message: string, data?: unknown): void {
    this.writeLog(LogLevel.INFO, message, data)
  }

  /**
   * 警告级别日志
   */
  public warn(message: string, data?: unknown): void {
    this.writeLog(LogLevel.WARN, message, data)
  }

  /**
   * 错误级别日志
   */
  public error(message: string, data?: unknown): void {
    this.writeLog(LogLevel.ERROR, message, data)
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }

    if (this.config.enableFile && this.config.logFile) {
      this.ensureLogDirectory()
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): LoggerConfig {
    return { ...this.config }
  }
}

/**
 * 默认日志实例
 */
export const logger = Logger.getInstance({
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false
})
