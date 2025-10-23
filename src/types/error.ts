/**
 * 错误类型枚举
 */
export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  FILE_ERROR = 'FILE_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

/**
 * 发布错误接口
 */
export interface PublishError {
  type: ErrorType;
  message: string;
  details?: unknown;
  packageName?: string;
  retryable: boolean;
}

/**
 * 进度跟踪器接口
 */
export interface ProgressTracker {
  total: number;
  completed: number;
  failed: number;

  updateProgress(packageName: string, status: 'scanning' | 'checking' | 'uploading' | 'completed' | 'failed'): void;
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
 * 可重试操作接口
 */
export interface RetryableOperation {
  /**
   * 执行带重试的操作
   * @param operation 要执行的操作
   * @param maxRetries 最大重试次数
   * @param delay 重试延迟（毫秒）
   * @returns 操作结果
   */
  executeWithRetry<T>(operation: () => Promise<T>, maxRetries?: number, delay?: number): Promise<T>;
}
