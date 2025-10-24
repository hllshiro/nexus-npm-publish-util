/**
 * 发布配置接口
 */
export interface CliArgs {
  publishDir: string;
  publishRegistry: string;
  publishAuth: string;
  threadNumber: number;
}

/**
 * 优化后的发布配置接口
 */
export interface PublishConfig extends CliArgs {
  /** 文件扫描模式，默认为递归扫描 */
  scanPattern?: string;
  /** HTTP请求超时时间（毫秒） */
  requestTimeout?: number;
  /** 连接超时时间（毫秒） */
  connectTimeout?: number;
  /** 是否启用详细日志记录 */
  enableDetailedLogging?: boolean;
}

/**
 * 操作结果接口
 */
export interface OperationResult {
  success: number;
  failed: string[];
}
/**
 * 错误类型枚举
 */
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  REGISTRY_ERROR = 'REGISTRY_ERROR',
  PACKAGE_NOT_FOUND = 'PACKAGE_NOT_FOUND',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  MULTIPART_ERROR = 'MULTIPART_ERROR',
}

/**
 * 发布错误接口
 */
export interface PublishError {
  type: ErrorType;
  message: string;
  details?: unknown;
  packageName?: string;
}

/**
 * 进度跟踪器接口
 */
export interface ProgressTracker {
  total: number;
  completed: number;
  failed: number;

  updateProgress(
    packageName: string,
    status: 'scanning' | 'checking' | 'uploading' | 'completed' | 'failed',
    additionalInfo?: {
      error?: string;
      statusCode?: number;
      needsUpload?: boolean;
      statusDetail?: string;
    }
  ): void;
  getProgressReport(): ProgressReport;
}

/**
 * 进度报告接口
 */
export interface ProgressReport {
  totalPackages: number;
  scannedPackages: number;
  checkedPackages: number;
  uploadedPackages: number;
  failedPackages: number;
  currentOperation: string;
}

/**
 * 包检查错误接口
 */
export interface PackageCheckError extends PublishError {
  type:
    | ErrorType.REGISTRY_ERROR
    | ErrorType.PACKAGE_NOT_FOUND
    | ErrorType.NETWORK_ERROR
    | ErrorType.TIMEOUT_ERROR
    | ErrorType.PARSE_ERROR;
  registryUrl?: string;
  packageName: string;
  version?: string;
}

/**
 * 包上传错误接口
 */
export interface PackageUploadError extends PublishError {
  type:
    | ErrorType.UPLOAD_ERROR
    | ErrorType.MULTIPART_ERROR
    | ErrorType.AUTH_ERROR
    | ErrorType.NETWORK_ERROR
    | ErrorType.TIMEOUT_ERROR
    | ErrorType.FILE_ERROR;
  uploadUrl?: string;
  packageName: string;
  filePath?: string;
  statusCode?: number;
  responseBody?: string;
}

/**
 * 错误严重程度枚举
 */
export enum ErrorSeverity {
  /** 低严重程度 - 警告级别 */
  LOW = 'LOW',
  /** 中等严重程度 - 错误级别但可恢复 */
  MEDIUM = 'MEDIUM',
  /** 高严重程度 - 严重错误，需要立即处理 */
  HIGH = 'HIGH',
  /** 关键严重程度 - 系统级错误 */
  CRITICAL = 'CRITICAL',
}

/**
 * 错误分类接口
 */
export interface ErrorClassification {
  /** 错误类型 */
  type: ErrorType;
  /** 严重程度 */
  severity: ErrorSeverity;
  /** 是否可重试 */
  retryable: boolean;
  /** 用户友好的错误描述 */
  description: string;
}

/**
 * 错误统计接口
 */
export interface ErrorStatistics {
  /** 总错误数 */
  total: number;
  /** 按类型分组的错误数 */
  byType: Record<ErrorType, number>;
  /** 按严重程度分组的错误数 */
  bySeverity: Record<ErrorSeverity, number>;
  /** 可重试错误数 */
  retryable: number;
  /** 不可重试错误数 */
  nonRetryable: number;
}
/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  level: LogLevel;
  logFile?: string;
  enableConsole: boolean;
  enableFile: boolean;
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
}

/**
 * 包依赖信息
 */
export interface PackageDependency {
  [packageName: string]: string;
}

/**
 * 包信息接口 - 用于新的文件扫描功能
 */
export interface PackageInfo {
  /** 文件完整路径 */
  filePath: string;
  /** 文件名 */
  fileName: string;
  /** 包名（从package.json解析） */
  packageName: string;
  /** 版本号（从package.json解析） */
  version: string;
  /** 包描述（可选） */
  description?: string;
}

/**
 * 包扫描器接口
 */
export interface PackageScanner {
  /**
   * 扫描指定目录下的所有.tgz文件
   * @param directory 扫描目录
   * @returns 文件路径列表
   */
  scanPackages(directory: string): Promise<string[]>;
}

/**
 * 包信息提取器接口
 */
export interface PackageInfoExtractor {
  /**
   * 从.tgz文件中提取包信息
   * @param tgzFilePath .tgz文件路径
   * @returns 解析结果
   */
  extractPackageInfo(tgzFilePath: string): Promise<PackageInfo | null>;
}

/**
 * 从.tgz文件内部解析的package.json结构
 */
export interface TarPackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * 包检查器接口
 */
export interface PackageChecker {
  /**
   * 检查包是否存在于远程仓库
   * @param packageName 包名
   * @param version 版本号
   * @param registryUrl 仓库URL
   * @returns 是否存在
   */
  checkPackageExists(packageName: string, version: string, registryUrl: string): Promise<boolean>;
}

/**
 * 包注册表响应接口
 */
export interface PackageRegistryResponse {
  name: string;
  versions: Record<string, unknown>;
  'dist-tags': {
    latest: string;
  };
}

/**
 * 包上传器接口
 */
export interface PackageUploader {
  /**
   * 上传包文件到远程仓库
   * @param filePath 文件路径
   * @param uploadUrl 上传URL
   * @param auth 认证信息
   * @returns 上传结果
   */
  uploadPackage(filePath: string, uploadUrl: string, auth: string): Promise<UploadResult>;
}

/**
 * 上传结果接口
 */
export interface UploadResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  responseBody?: string;
}

/**
 * 包管理器接口
 */
export interface PackageManager {
  /**
   * 执行完整的发布流程
   * @param config 发布配置
   * @returns 操作结果
   */
  publishPackages(config: PublishConfig): Promise<OperationResult>;
}

/**
 * 发布任务接口
 */
export interface PublishTask {
  packageInfo: PackageInfo;
  needsUpload: boolean;
  uploadResult?: UploadResult;
}

/**
 * 任务执行统计接口
 */
export interface TaskExecutionStats {
  /** 总包数 */
  totalPackages: number;
  /** 扫描到的包数 */
  scannedPackages: number;
  /** 需要上传的包数 */
  packagesNeedingUpload: number;
  /** 成功上传的包数 */
  successfulUploads: number;
  /** 失败的包数 */
  failedPackages: number;
  /** 跳过的包数（已存在） */
  skippedPackages: number;
  /** 总耗时（毫秒） */
  totalElapsedTime: number;
  /** 各阶段耗时 */
  phaseTimings: {
    scanning: number;
    checking: number;
    uploading: number;
  };
}

/**
 * 包检查配置接口
 */
export interface PackageCheckerConfig {
  /** 连接超时时间（毫秒），默认10秒 */
  connectTimeout?: number;
  /** 请求超时时间（毫秒），默认30秒 */
  requestTimeout?: number;
}

/**
 * 上传配置接口
 */
export interface UploadConfig {
  /** HTTP请求超时时间（毫秒），默认300秒 */
  requestTimeout?: number;
  /** 连接超时时间（毫秒），默认30秒 */
  connectTimeout?: number;
  /** 是否记录详细的请求响应日志 */
  enableDetailedLogging?: boolean;
  /** 进度跟踪器实例（可选） */
  progressTracker?: ProgressTracker;
}

/**
 * 包上传状态枚举
 */
export enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * 包上传信息接口
 */
export interface PackageUploadInfo {
  /** 包名 */
  packageName: string;
  /** 文件路径 */
  filePath: string;
  /** 当前状态 */
  status: UploadStatus;
  /** 详细状态（用于进度计算） */
  detailedStatus?: string;
  /** 开始时间 */
  startTime?: Date;
  /** 完成时间 */
  endTime?: Date;
  /** 错误信息 */
  error?: string;
  /** 上传大小（字节） */
  fileSize?: number;
  /** HTTP状态码 */
  statusCode?: number;
}

/**
 * 包处理状态枚举
 */
export enum PackageStatus {
  /** 待处理 */
  PENDING = 'pending',
  /** 扫描中 */
  SCANNING = 'scanning',
  /** 检查中 */
  CHECKING = 'checking',
  /** 上传中 */
  UPLOADING = 'uploading',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 已失败 */
  FAILED = 'failed',
  /** 已跳过 */
  SKIPPED = 'skipped',
}

/**
 * 包处理详细信息接口
 */
export interface PackageProcessInfo {
  /** 包信息 */
  packageInfo: PackageInfo;
  /** 当前状态 */
  status: PackageStatus;
  /** 详细状态描述 */
  statusDetail?: string;
  /** 开始时间 */
  startTime?: Date;
  /** 完成时间 */
  endTime?: Date;
  /** 错误信息 */
  error?: string | undefined;
  /** 处理阶段时间记录 */
  phaseTimings: {
    scanStart?: Date;
    scanEnd?: Date;
    checkStart?: Date;
    checkEnd?: Date;
    uploadStart?: Date;
    uploadEnd?: Date;
  };
  /** 是否需要上传 */
  needsUpload?: boolean | undefined;
  /** HTTP状态码（上传时） */
  statusCode?: number | undefined;
}

/**
 * 阶段统计信息接口
 */
export interface PhaseStatistics {
  /** 阶段名称 */
  phase: string;
  /** 已处理数量 */
  processed: number;
  /** 成功数量 */
  successful: number;
  /** 失败数量 */
  failed: number;
  /** 跳过数量 */
  skipped: number;
  /** 平均处理时间（毫秒） */
  averageTime: number;
  /** 总处理时间（毫秒） */
  totalTime: number;
}

/**
 * 详细进度报告接口
 */
export interface DetailedProgressReport extends ProgressReport {
  /** 各阶段统计 */
  phaseStatistics: PhaseStatistics[];
  /** 处理速率（包/秒） */
  processingRate: number;
  /** 预估剩余时间（秒） */
  estimatedRemainingTime: number;
  /** 总耗时（毫秒） */
  totalElapsedTime: number;
  /** 错误列表 */
  errors: Array<{
    packageName: string;
    error: string;
    phase: string;
  }>;
}

/**
 * Registry URL解析结果接口
 */
export interface RegistryUrlInfo {
  /** 基础URL，例如: http://localhost:8081/ */
  baseUrl: string;
  /** 仓库名称，例如: npm */
  repository: string;
  /** 完整的registry URL */
  fullUrl: string;
}
