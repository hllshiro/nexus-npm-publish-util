import { logger } from './logger.js'
import {
  LpmError,
  ConfigError,
  FileError,
  DownloadError,
  PublishError,
  LockfileError,
  CliError,
  NetworkError
} from './errors.js'
import { ErrorCode, ErrorSeverity } from '../types/errors.js'
import type { ErrorContext, ErrorHandlerOptions, ErrorHandlingResult } from '../types/errors.js'

/**
 * 统一错误处理器类
 */
export class ErrorHandler {
  private static instance: ErrorHandler
  private options: ErrorHandlerOptions

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      logError: true,
      exitOnCritical: true,
      showStackTrace: false,
      suppressConsoleOutput: false,
      ...options
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(options?: ErrorHandlerOptions): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(options)
    }
    return ErrorHandler.instance
  }

  /**
   * 处理错误
   */
  public handle(error: Error | LpmError, context?: ErrorContext): ErrorHandlingResult {
    const lpmError = this.normalizeError(error, context)

    // 记录错误日志
    if (this.options.logError) {
      this.logError(lpmError)
    }

    // 显示错误信息
    if (!this.options.suppressConsoleOutput) {
      this.displayError(lpmError)
    }

    // 确定是否需要退出
    const shouldExit = this.shouldExitProcess(lpmError)
    const exitCode = this.getExitCode(lpmError)

    return {
      handled: true,
      shouldExit,
      exitCode
    }
  }

  /**
   * 标准化错误对象
   */
  private normalizeError(error: Error | LpmError, context?: ErrorContext): LpmError {
    if (error instanceof LpmError) {
      // 如果提供了额外的上下文，合并到现有上下文中
      if (context) {
        const mergedContext = { ...error.context, ...context }
        return new LpmError(error.message, error.code, error.severity, mergedContext, error.originalError)
      }
      return error
    }

    // 将普通Error转换为LpmError
    return new LpmError(error.message, ErrorCode.UNKNOWN_ERROR, ErrorSeverity.MEDIUM, context, error)
  }

  /**
   * 记录错误日志
   */
  private logError(error: LpmError): void {
    const logData = {
      code: error.code,
      severity: error.severity,
      context: error.context,
      timestamp: error.timestamp,
      stack: this.options.showStackTrace ? error.stack : undefined
    }

    switch (error.severity) {
      case ErrorSeverity.LOW:
        logger.info(error.getFullMessage(), logData)
        break
      case ErrorSeverity.MEDIUM:
        logger.warn(error.getFullMessage(), logData)
        break
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        logger.error(error.getFullMessage(), logData)
        break
    }
  }

  /**
   * 显示错误信息
   */
  private displayError(error: LpmError): void {
    const prefix = this.getErrorPrefix(error.severity)
    const message = error.getFullMessage()

    switch (error.severity) {
      case ErrorSeverity.LOW:
        console.info(`${prefix} ${message}`)
        break
      case ErrorSeverity.MEDIUM:
        console.warn(`${prefix} ${message}`)
        break
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        console.error(`${prefix} ${message}`)
        break
    }

    // 显示堆栈跟踪（如果启用）
    if (this.options.showStackTrace && error.stack) {
      console.error(error.stack)
    }
  }

  /**
   * 获取错误前缀
   */
  private getErrorPrefix(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW:
        return '[INFO]'
      case ErrorSeverity.MEDIUM:
        return '[WARN]'
      case ErrorSeverity.HIGH:
        return '[ERROR]'
      case ErrorSeverity.CRITICAL:
        return '[CRITICAL]'
      default:
        return '[ERROR]'
    }
  }

  /**
   * 判断是否应该退出进程
   */
  private shouldExitProcess(error: LpmError): boolean {
    if (!this.options.exitOnCritical) {
      return false
    }

    return error.severity === ErrorSeverity.CRITICAL
  }

  /**
   * 获取退出代码
   */
  private getExitCode(error: LpmError): number {
    switch (error.code) {
      case ErrorCode.INVALID_CONFIG:
      case ErrorCode.MISSING_REQUIRED_CONFIG:
      case ErrorCode.CLI_INVALID_ARGUMENT:
      case ErrorCode.CLI_MISSING_ARGUMENT:
        return 1 // 配置/参数错误

      case ErrorCode.FILE_NOT_FOUND:
      case ErrorCode.FILE_READ_ERROR:
      case ErrorCode.FILE_PERMISSION_ERROR:
        return 2 // 文件操作错误

      case ErrorCode.DOWNLOAD_FAILED:
      case ErrorCode.DOWNLOAD_NETWORK_ERROR:
      case ErrorCode.NETWORK_ERROR:
        return 3 // 网络相关错误

      case ErrorCode.PUBLISH_FAILED:
      case ErrorCode.PUBLISH_AUTH_ERROR:
        return 4 // 发布相关错误

      case ErrorCode.LOCKFILE_PARSE_ERROR:
      case ErrorCode.LOCKFILE_FORMAT_INVALID:
        return 5 // 锁文件相关错误

      default:
        return 1 // 通用错误
    }
  }

  /**
   * 更新错误处理选项
   */
  public updateOptions(options: Partial<ErrorHandlerOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * 获取当前选项
   */
  public getOptions(): ErrorHandlerOptions {
    return { ...this.options }
  }
}

/**
 * 创建特定类型的错误
 */
export class ErrorFactory {
  /**
   * 创建配置错误
   */
  public static createConfigError(
    message: string,
    code: ErrorCode = ErrorCode.INVALID_CONFIG,
    context?: ErrorContext,
    originalError?: Error
  ): ConfigError {
    return new ConfigError(message, code, context, originalError)
  }

  /**
   * 创建文件错误
   */
  public static createFileError(
    message: string,
    code: ErrorCode = ErrorCode.FILE_READ_ERROR,
    context?: ErrorContext,
    originalError?: Error
  ): FileError {
    return new FileError(message, code, context, originalError)
  }

  /**
   * 创建下载错误
   */
  public static createDownloadError(
    message: string,
    code: ErrorCode = ErrorCode.DOWNLOAD_FAILED,
    context?: ErrorContext,
    originalError?: Error
  ): DownloadError {
    return new DownloadError(message, code, context, originalError)
  }

  /**
   * 创建发布错误
   */
  public static createPublishError(
    message: string,
    code: ErrorCode = ErrorCode.PUBLISH_FAILED,
    context?: ErrorContext,
    originalError?: Error
  ): PublishError {
    return new PublishError(message, code, context, originalError)
  }

  /**
   * 创建锁文件错误
   */
  public static createLockfileError(
    message: string,
    code: ErrorCode = ErrorCode.LOCKFILE_PARSE_ERROR,
    context?: ErrorContext,
    originalError?: Error
  ): LockfileError {
    return new LockfileError(message, code, context, originalError)
  }

  /**
   * 创建CLI错误
   */
  public static createCliError(
    message: string,
    code: ErrorCode = ErrorCode.CLI_INVALID_ARGUMENT,
    context?: ErrorContext,
    originalError?: Error
  ): CliError {
    return new CliError(message, code, context, originalError)
  }

  /**
   * 创建网络错误
   */
  public static createNetworkError(
    message: string,
    code: ErrorCode = ErrorCode.NETWORK_ERROR,
    context?: ErrorContext,
    originalError?: Error
  ): NetworkError {
    return new NetworkError(message, code, context, originalError)
  }
}

/**
 * 默认错误处理器实例
 */
export const errorHandler = ErrorHandler.getInstance({
  logError: true,
  exitOnCritical: true,
  showStackTrace: false,
  suppressConsoleOutput: false
})

/**
 * 便捷的错误处理函数
 */
export function handleError(error: Error | LpmError, context?: ErrorContext): ErrorHandlingResult {
  return errorHandler.handle(error, context)
}

/**
 * 异步操作错误包装器
 */
export async function withErrorHandling<T>(operation: () => Promise<T>, context?: ErrorContext): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const result = handleError(error as Error, context)

    if (result.shouldExit) {
      process.exit(result.exitCode)
    }

    throw error
  }
}

/**
 * 同步操作错误包装器
 */
export function withErrorHandlingSync<T>(operation: () => T, context?: ErrorContext): T {
  try {
    return operation()
  } catch (error) {
    const result = handleError(error as Error, context)

    if (result.shouldExit) {
      process.exit(result.exitCode)
    }

    throw error
  }
}
