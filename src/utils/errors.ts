import { ErrorCode, ErrorSeverity } from '../types/errors.js'
import type { ErrorContext } from '../types/errors.js'

/**
 * 自定义LPM错误基类
 */
export class LpmError extends Error {
  public readonly code: ErrorCode
  public readonly severity: ErrorSeverity
  public readonly context: ErrorContext | undefined
  public readonly timestamp: Date
  public readonly originalError: Error | undefined

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message)

    this.name = 'LpmError'
    this.code = code
    this.severity = severity
    this.context = context
    this.timestamp = new Date()
    this.originalError = originalError

    // 确保错误堆栈正确显示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LpmError)
    }
  }

  /**
   * 获取完整的错误信息
   */
  public getFullMessage(): string {
    let fullMessage = `[${this.code}] ${this.message}`

    if (this.context) {
      const contextStr = Object.entries(this.context)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      fullMessage += ` (${contextStr})`
    }

    if (this.originalError) {
      fullMessage += ` | Original: ${this.originalError.message}`
    }

    return fullMessage
  }

  /**
   * 转换为JSON格式
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack
          }
        : undefined
    }
  }
}

/**
 * 配置相关错误
 */
export class ConfigError extends LpmError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INVALID_CONFIG,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, code, ErrorSeverity.HIGH, context, originalError)
    this.name = 'ConfigError'
  }
}

/**
 * 文件操作相关错误
 */
export class FileError extends LpmError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.FILE_READ_ERROR,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, code, ErrorSeverity.MEDIUM, context, originalError)
    this.name = 'FileError'
  }
}

/**
 * 下载相关错误
 */
export class DownloadError extends LpmError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.DOWNLOAD_FAILED,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, code, ErrorSeverity.MEDIUM, context, originalError)
    this.name = 'DownloadError'
  }
}

/**
 * 发布相关错误
 */
export class PublishError extends LpmError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PUBLISH_FAILED,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, code, ErrorSeverity.MEDIUM, context, originalError)
    this.name = 'PublishError'
  }
}

/**
 * 锁文件解析相关错误
 */
export class LockfileError extends LpmError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.LOCKFILE_PARSE_ERROR,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, code, ErrorSeverity.HIGH, context, originalError)
    this.name = 'LockfileError'
  }
}

/**
 * CLI相关错误
 */
export class CliError extends LpmError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.CLI_INVALID_ARGUMENT,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, code, ErrorSeverity.HIGH, context, originalError)
    this.name = 'CliError'
  }
}

/**
 * 网络相关错误
 */
export class NetworkError extends LpmError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NETWORK_ERROR,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message, code, ErrorSeverity.MEDIUM, context, originalError)
    this.name = 'NetworkError'
  }
}
