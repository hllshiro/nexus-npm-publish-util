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
