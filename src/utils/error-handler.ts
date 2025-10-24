import type {
  PublishError,
  PackageCheckError,
  PackageUploadError,
  ErrorClassification,
  ErrorStatistics,
} from '../types/error.js';
import { ErrorType, ErrorSeverity } from '../types/error.js';
import { logger } from './logger.js';

/**
 * 错误处理工具类
 * 提供统一的错误格式化、分类和日志记录功能
 */
export class ErrorHandler {
  /**
   * 格式化错误信息为用户友好的消息
   * @param error 发布错误对象
   * @returns 格式化后的错误消息
   */
  public static formatError(error: PublishError): string {
    const baseMessage = `[${error.type}] ${error.message}`;

    if (error.packageName) {
      return `包 "${error.packageName}": ${baseMessage}`;
    }

    return baseMessage;
  }

  /**
   * 格式化详细错误信息，包含调试信息
   * @param error 发布错误对象
   * @returns 详细的错误信息
   */
  public static formatDetailedError(error: PublishError): string {
    let message = this.formatError(error);

    // 添加包检查特定信息
    if (this.isPackageCheckError(error)) {
      if (error.registryUrl) {
        message += `\n  注册表URL: ${this.sanitizeUrl(error.registryUrl)}`;
      }
      if (error.version) {
        message += `\n  版本: ${error.version}`;
      }
    }

    // 添加包上传特定信息
    if (this.isPackageUploadError(error)) {
      if (error.uploadUrl) {
        message += `\n  上传URL: ${this.sanitizeUrl(error.uploadUrl)}`;
      }
      if (error.filePath) {
        message += `\n  文件路径: ${error.filePath}`;
      }
      if (error.statusCode) {
        message += `\n  HTTP状态码: ${error.statusCode}`;
      }
      if (error.responseBody) {
        message += `\n  响应内容: ${this.sanitizeResponseBody(error.responseBody)}`;
      }
    }

    // 添加详细信息（如果存在且不敏感）
    if (error.details) {
      const sanitizedDetails = this.sanitizeDetails(error.details);
      if (sanitizedDetails) {
        message += `\n  详细信息: ${JSON.stringify(sanitizedDetails, null, 2)}`;
      }
    }

    return message;
  }

  /**
   * 记录错误日志
   * @param error 发布错误对象
   * @param context 额外的上下文信息
   */
  public static logError(error: PublishError, context?: string): void {
    const contextPrefix = context ? `[${context}] ` : '';
    const errorMessage = `${contextPrefix}${this.formatError(error)}`;

    // 根据错误类型选择日志级别
    if (this.isCriticalError(error.type)) {
      logger.error(errorMessage, this.sanitizeErrorForLogging(error));
    } else {
      logger.warn(errorMessage, this.sanitizeErrorForLogging(error));
    }
  }

  /**
   * 创建标准化的发布错误对象
   * @param type 错误类型
   * @param message 错误消息
   * @param packageName 包名（可选）
   * @param details 详细信息（可选）
   * @returns 发布错误对象
   */
  public static createError(type: ErrorType, message: string, packageName?: string, details?: unknown): PublishError {
    const error: PublishError = {
      type,
      message,
      details: this.sanitizeDetails(details),
    };

    if (packageName) {
      error.packageName = packageName;
    }

    return error;
  }

  /**
   * 创建包检查错误对象
   */
  public static createPackageCheckError(
    type: PackageCheckError['type'],
    message: string,
    packageName: string,
    version?: string,
    registryUrl?: string,
    details?: unknown
  ): PackageCheckError {
    const error: PackageCheckError = {
      type,
      message,
      packageName,
      details: this.sanitizeDetails(details),
    };

    if (version !== undefined) error.version = version;
    if (registryUrl !== undefined) error.registryUrl = registryUrl;

    return error;
  }

  /**
   * 创建包上传错误对象
   */
  public static createPackageUploadError(
    type: PackageUploadError['type'],
    message: string,
    packageName: string,
    filePath?: string,
    uploadUrl?: string,
    statusCode?: number,
    responseBody?: string,
    details?: unknown
  ): PackageUploadError {
    const error: PackageUploadError = {
      type,
      message,
      packageName,
      details: this.sanitizeDetails(details),
    };

    if (filePath !== undefined) error.filePath = filePath;
    if (uploadUrl !== undefined) error.uploadUrl = uploadUrl;
    if (statusCode !== undefined) error.statusCode = statusCode;
    if (responseBody !== undefined) error.responseBody = this.sanitizeResponseBody(responseBody);

    return error;
  }

  /**
   * 判断是否为关键错误（需要ERROR级别日志）
   */
  private static isCriticalError(errorType: ErrorType): boolean {
    const criticalErrors = [
      ErrorType.AUTH_ERROR,
      ErrorType.FILE_ERROR,
      ErrorType.UPLOAD_ERROR,
      ErrorType.MULTIPART_ERROR,
    ];
    return criticalErrors.includes(errorType);
  }

  /**
   * 类型守卫：检查是否为包检查错误
   */
  private static isPackageCheckError(error: PublishError): error is PackageCheckError {
    return 'registryUrl' in error || 'version' in error;
  }

  /**
   * 类型守卫：检查是否为包上传错误
   */
  private static isPackageUploadError(error: PublishError): error is PackageUploadError {
    return 'uploadUrl' in error || 'filePath' in error || 'statusCode' in error;
  }

  /**
   * 清理URL中的敏感信息（如认证信息）
   */
  private static sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // 移除用户名和密码
      urlObj.username = '';
      urlObj.password = '';
      return urlObj.toString();
    } catch {
      // 如果URL格式不正确，返回脱敏后的字符串
      return url.replace(/\/\/[^@]+@/, '//***@');
    }
  }

  /**
   * 清理响应内容中的敏感信息
   */
  private static sanitizeResponseBody(responseBody: string): string {
    // 限制响应内容长度，避免日志过长
    const maxLength = 1000;
    let sanitized = responseBody.length > maxLength ? responseBody.substring(0, maxLength) + '...[截断]' : responseBody;

    // 移除可能的敏感信息模式
    sanitized = sanitized
      .replace(/("token"|"password"|"auth"|"key")\s*:\s*"[^"]+"/gi, '"$1": "***"')
      .replace(/authorization:\s*[^\s,}]+/gi, 'authorization: ***')
      .replace(/bearer\s+[^\s,}]+/gi, 'bearer ***');

    return sanitized;
  }

  /**
   * 清理详细信息中的敏感数据
   */
  private static sanitizeDetails(details: unknown): unknown {
    if (!details) return details;

    // 如果是字符串，应用基本的敏感信息过滤
    if (typeof details === 'string') {
      return this.sanitizeResponseBody(details);
    }

    // 如果是对象，递归清理
    if (typeof details === 'object' && details !== null) {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(details)) {
        const lowerKey = key.toLowerCase();

        // 敏感字段列表
        if (
          lowerKey.includes('token') ||
          lowerKey.includes('password') ||
          lowerKey.includes('auth') ||
          lowerKey.includes('key') ||
          lowerKey.includes('secret')
        ) {
          sanitized[key] = '***';
        } else if (typeof value === 'string') {
          sanitized[key] = this.sanitizeResponseBody(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeDetails(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    }

    return details;
  }

  /**
   * 为日志记录清理错误对象
   */
  private static sanitizeErrorForLogging(error: PublishError): PublishError {
    const sanitized: PublishError = {
      type: error.type,
      message: error.message,
      details: this.sanitizeDetails(error.details),
    };

    if (error.packageName) {
      sanitized.packageName = error.packageName;
    }

    // 清理包检查错误的特定字段
    if (this.isPackageCheckError(error)) {
      const checkError = error as PackageCheckError;
      const sanitizedCheckError = sanitized as PackageCheckError;

      if (checkError.registryUrl) {
        sanitizedCheckError.registryUrl = this.sanitizeUrl(checkError.registryUrl);
      }
      if (checkError.version) {
        sanitizedCheckError.version = checkError.version;
      }
    }

    // 清理包上传错误的特定字段
    if (this.isPackageUploadError(error)) {
      const uploadError = error as PackageUploadError;
      const sanitizedUploadError = sanitized as PackageUploadError;

      if (uploadError.uploadUrl) {
        sanitizedUploadError.uploadUrl = this.sanitizeUrl(uploadError.uploadUrl);
      }
      if (uploadError.filePath) {
        sanitizedUploadError.filePath = uploadError.filePath;
      }
      if (uploadError.statusCode) {
        sanitizedUploadError.statusCode = uploadError.statusCode;
      }
      if (uploadError.responseBody) {
        sanitizedUploadError.responseBody = this.sanitizeResponseBody(uploadError.responseBody);
      }
    }

    return sanitized;
  }
}

/**
 * 错误分类器
 * 提供错误分类、严重程度评估和统计功能
 */
export class ErrorClassifier {
  private static readonly ERROR_CLASSIFICATIONS: Record<ErrorType, ErrorClassification> = {
    [ErrorType.NETWORK_ERROR]: {
      type: ErrorType.NETWORK_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      description: '网络连接错误，通常是临时性问题',
    },
    [ErrorType.AUTH_ERROR]: {
      type: ErrorType.AUTH_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      description: '认证失败，需要检查认证信息',
    },
    [ErrorType.FILE_ERROR]: {
      type: ErrorType.FILE_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      description: '文件操作错误，需要检查文件权限和路径',
    },
    [ErrorType.PARSE_ERROR]: {
      type: ErrorType.PARSE_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      description: '数据解析错误，通常是格式问题',
    },
    [ErrorType.TIMEOUT_ERROR]: {
      type: ErrorType.TIMEOUT_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      description: '请求超时，可能是网络或服务器响应慢',
    },
    [ErrorType.REGISTRY_ERROR]: {
      type: ErrorType.REGISTRY_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      description: '注册表服务错误，可能是服务器临时问题',
    },
    [ErrorType.PACKAGE_NOT_FOUND]: {
      type: ErrorType.PACKAGE_NOT_FOUND,
      severity: ErrorSeverity.LOW,
      retryable: false,
      description: '包不存在，这通常是正常情况',
    },
    [ErrorType.UPLOAD_ERROR]: {
      type: ErrorType.UPLOAD_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      description: '包上传失败，可能是网络或服务器问题',
    },
    [ErrorType.MULTIPART_ERROR]: {
      type: ErrorType.MULTIPART_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      description: '文件上传格式错误，需要检查文件格式',
    },
  };

  /**
   * 获取错误分类信息
   */
  public static getClassification(errorType: ErrorType): ErrorClassification {
    return this.ERROR_CLASSIFICATIONS[errorType];
  }

  /**
   * 判断错误是否可重试
   */
  public static isRetryable(error: PublishError): boolean {
    return this.getClassification(error.type).retryable;
  }

  /**
   * 获取错误严重程度
   */
  public static getSeverity(error: PublishError): ErrorSeverity {
    return this.getClassification(error.type).severity;
  }

  /**
   * 获取用户友好的错误描述
   */
  public static getDescription(error: PublishError): string {
    return this.getClassification(error.type).description;
  }

  /**
   * 计算错误统计信息
   */
  public static calculateStatistics(errors: PublishError[]): ErrorStatistics {
    const statistics: ErrorStatistics = {
      total: errors.length,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      retryable: 0,
      nonRetryable: 0,
    };

    // 初始化计数器
    Object.values(ErrorType).forEach((type) => {
      statistics.byType[type] = 0;
    });
    Object.values(ErrorSeverity).forEach((severity) => {
      statistics.bySeverity[severity] = 0;
    });

    // 统计错误
    errors.forEach((error) => {
      const classification = this.getClassification(error.type);

      statistics.byType[error.type]++;
      statistics.bySeverity[classification.severity]++;

      if (classification.retryable) {
        statistics.retryable++;
      } else {
        statistics.nonRetryable++;
      }
    });

    return statistics;
  }

  /**
   * 格式化错误统计报告
   */
  public static formatStatisticsReport(statistics: ErrorStatistics): string {
    if (statistics.total === 0) {
      return '没有错误发生';
    }

    const lines: string[] = [`错误统计报告 (总计: ${statistics.total})`, '='.repeat(40)];

    // 按类型统计
    lines.push('\n按错误类型:');
    Object.entries(statistics.byType)
      .filter(([, count]) => count > 0)
      .forEach(([type, count]) => {
        const classification = this.getClassification(type as ErrorType);
        lines.push(`  ${type}: ${count} (${classification.description})`);
      });

    // 按严重程度统计
    lines.push('\n按严重程度:');
    Object.entries(statistics.bySeverity)
      .filter(([, count]) => count > 0)
      .forEach(([severity, count]) => {
        lines.push(`  ${severity}: ${count}`);
      });

    // 可重试性统计
    lines.push('\n可重试性:');
    lines.push(`  可重试: ${statistics.retryable}`);
    lines.push(`  不可重试: ${statistics.nonRetryable}`);

    return lines.join('\n');
  }
}
