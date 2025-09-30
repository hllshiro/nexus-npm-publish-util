// Logger exports
export { Logger, logger } from './logger.js'

// Error exports
export {
  LpmError,
  ConfigError,
  FileError,
  DownloadError,
  PublishError,
  LockfileError,
  CliError,
  NetworkError
} from './errors.js'

// Error handler exports
export {
  ErrorHandler,
  ErrorFactory,
  errorHandler,
  handleError,
  withErrorHandling,
  withErrorHandlingSync
} from './error-handler.js'

// Re-export types from types directory
export { LogLevel, ErrorCode, ErrorSeverity } from '../types/index.js'

export type { LoggerConfig, LogEntry, ErrorContext, ErrorHandlerOptions, ErrorHandlingResult } from '../types/index.js'
