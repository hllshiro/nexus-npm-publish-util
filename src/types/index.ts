/**
 * 类型定义统一导出
 */

// 配置相关类型
export type { PublishConfig, OptimizedPublishConfig, CliArgs, OperationResult } from './config.js';

// 包相关类型
export type {
  ServicePackageItem,
  ServicePackageListResponse,
  PackageDependency,
  PackageInfo,
  PackageScanner,
  PackageInfoExtractor,
  TarPackageJson,
  PackageChecker,
  PackageRegistryResponse,
  PackageUploader,
  UploadResult,
  PackageManager,
  PublishTask,
} from './package.js';

// 错误处理相关类型
export { ErrorType } from './error.js';

export type { PublishError, ProgressTracker, ProgressReport, RetryableOperation } from './error.js';

// 日志相关类型
export type { LogLevel, LoggerConfig } from './logger.js';
