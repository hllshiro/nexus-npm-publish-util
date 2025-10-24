import { EnhancedLogger } from './enhanced-logger.js';
import { ErrorHandler, ErrorClassifier } from './error-handler.js';
import type { PublishError, ErrorStatistics } from '../types/error.js';
import type { PackageInfo } from '../types/package.js';
import { LogLevel } from '../types/logger.js';

/**
 * 发布操作专用日志记录器
 * 提供发布流程相关的专门日志记录功能
 */
export class PublishLogger extends EnhancedLogger {
  private packageCount = 0;
  private processedCount = 0;
  private errors: PublishError[] = [];

  constructor() {
    super({
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: true,
      logFile: 'logs/app.log',
      enableStructuredLogging: true,
      enableSensitiveDataFilter: true,
      enableDurationTracking: true,
      maxLogEntryLength: 5000,
    });
  }

  /**
   * 记录发布会话开始
   */
  public logPublishStart(totalPackages: number, config: Record<string, unknown>): void {
    this.packageCount = totalPackages;
    this.processedCount = 0;
    this.errors = [];

    this.logStructured(LogLevel.INFO, {
      message: `开始发布会话，共 ${totalPackages} 个包`,
      operation: 'publish_session',
      status: 'started',
      metadata: {
        totalPackages,
        config: this.sanitizeConfig(config),
      },
    });
  }

  /**
   * 记录发布会话结束
   */
  public logPublishEnd(summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    duration: number;
  }): void {
    const errorStats = ErrorClassifier.calculateStatistics(this.errors);

    this.logStructured(LogLevel.INFO, {
      message: `发布会话完成 - 成功: ${summary.successful}, 失败: ${summary.failed}, 跳过: ${summary.skipped}`,
      operation: 'publish_session',
      status: 'completed',
      duration: summary.duration,
      metadata: {
        summary,
        errorStatistics: errorStats,
      },
    });

    // 如果有错误，记录错误统计报告
    if (this.errors.length > 0) {
      this.info('错误统计报告:\n' + ErrorClassifier.formatStatisticsReport(errorStats));
    }
  }

  /**
   * 记录包扫描开始
   */
  public logScanStart(directory: string): void {
    this.startOperation('scan', '包扫描', undefined, { directory });
  }

  /**
   * 记录包扫描完成
   */
  public logScanComplete(packages: PackageInfo[]): void {
    this.completeOperation('scan', '包扫描', undefined, {
      packagesFound: packages.length,
      packages: packages.map((p) => ({ name: p.packageName, version: p.version, file: p.fileName })),
    });
  }

  /**
   * 记录包扫描失败
   */
  public logScanFailed(error: PublishError): void {
    this.errors.push(error);
    ErrorHandler.logError(error, '包扫描');
    this.failOperation('scan', '包扫描', ErrorHandler.formatError(error));
  }

  /**
   * 记录包检查开始
   */
  public logCheckStart(packageInfo: PackageInfo, registryUrl: string): void {
    const operationId = `check_${packageInfo.packageName}`;
    this.startOperation(operationId, '包存在性检查', packageInfo.packageName, {
      version: packageInfo.version,
      registryUrl: this.sanitizeUrl(registryUrl),
    });
  }

  /**
   * 记录包检查完成
   */
  public logCheckComplete(packageInfo: PackageInfo, exists: boolean): void {
    const operationId = `check_${packageInfo.packageName}`;
    this.completeOperation(operationId, '包存在性检查', packageInfo.packageName, {
      exists,
      action: exists ? 'skip_upload' : 'proceed_upload',
    });
  }

  /**
   * 记录包检查失败
   */
  public logCheckFailed(packageInfo: PackageInfo, error: PublishError): void {
    this.errors.push(error);
    const operationId = `check_${packageInfo.packageName}`;
    ErrorHandler.logError(error, '包检查');
    this.failOperation(operationId, '包存在性检查', ErrorHandler.formatError(error), packageInfo.packageName);
  }

  /**
   * 记录包上传开始
   */
  public logUploadStart(packageInfo: PackageInfo, uploadUrl: string): void {
    const operationId = `upload_${packageInfo.packageName}`;
    this.startOperation(operationId, '包上传', packageInfo.packageName, {
      version: packageInfo.version,
      filePath: packageInfo.filePath,
      uploadUrl: this.sanitizeUrl(uploadUrl),
    });
  }

  /**
   * 记录包上传完成
   */
  public logUploadComplete(packageInfo: PackageInfo, statusCode: number, responseBody?: string): void {
    const operationId = `upload_${packageInfo.packageName}`;
    this.processedCount++;

    this.completeOperation(operationId, '包上传', packageInfo.packageName, {
      statusCode,
      responseBody: responseBody ? this.sanitizeResponseBody(responseBody) : undefined,
      progress: `${this.processedCount}/${this.packageCount}`,
    });

    // 记录进度
    this.logProgress(this.processedCount, this.packageCount, '包上传', packageInfo.packageName);
  }

  /**
   * 记录包上传失败
   */
  public logUploadFailed(packageInfo: PackageInfo, error: PublishError): void {
    this.errors.push(error);
    const operationId = `upload_${packageInfo.packageName}`;
    this.processedCount++;

    ErrorHandler.logError(error, '包上传');
    this.failOperation(operationId, '包上传', ErrorHandler.formatError(error), packageInfo.packageName, {
      progress: `${this.processedCount}/${this.packageCount}`,
    });

    // 记录进度
    this.logProgress(this.processedCount, this.packageCount, '包上传', packageInfo.packageName);
  }

  /**
   * 记录包上传跳过
   */
  public logUploadSkipped(packageInfo: PackageInfo, reason: string): void {
    const operationId = `upload_${packageInfo.packageName}`;
    this.processedCount++;

    this.skipOperation(operationId, '包上传', reason, packageInfo.packageName, {
      progress: `${this.processedCount}/${this.packageCount}`,
    });

    // 记录进度
    this.logProgress(this.processedCount, this.packageCount, '包上传', packageInfo.packageName);
  }

  /**
   * 记录并发控制信息
   */
  public logConcurrencyInfo(activeCount: number, maxConcurrency: number, queuedCount: number): void {
    this.logStructured(LogLevel.DEBUG, {
      message: `并发控制状态 - 活跃: ${activeCount}/${maxConcurrency}, 队列: ${queuedCount}`,
      operation: 'concurrency_control',
      metadata: {
        activeCount,
        maxConcurrency,
        queuedCount,
        utilizationRate: Math.round((activeCount / maxConcurrency) * 100),
      },
    });
  }

  /**
   * 记录性能统计
   */
  public logPerformanceStats(stats: {
    totalDuration: number;
    averagePackageTime: number;
    packagesPerSecond: number;
    networkTime: number;
    fileIOTime: number;
  }): void {
    this.logMetric('总耗时', stats.totalDuration, 'ms', stats);
    this.logMetric('平均包处理时间', stats.averagePackageTime, 'ms', stats);
    this.logMetric('包处理速率', stats.packagesPerSecond, 'packages/sec', stats);
    this.logMetric('网络耗时', stats.networkTime, 'ms', stats);
    this.logMetric('文件IO耗时', stats.fileIOTime, 'ms', stats);
  }

  /**
   * 获取当前错误统计
   */
  public getErrorStatistics(): ErrorStatistics {
    return ErrorClassifier.calculateStatistics(this.errors);
  }

  /**
   * 清理配置中的敏感信息
   */
  private sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      const lowerKey = key.toLowerCase();

      if (
        lowerKey.includes('auth') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('key')
      ) {
        sanitized[key] = '***';
      } else if (typeof value === 'string' && value.includes('://')) {
        // 可能是URL，需要清理
        sanitized[key] = this.sanitizeUrl(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 清理URL中的敏感信息
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.username = '';
      urlObj.password = '';
      return urlObj.toString();
    } catch {
      return url.replace(/\/\/[^@]+@/, '//***@');
    }
  }

  /**
   * 清理响应内容中的敏感信息
   */
  private sanitizeResponseBody(responseBody: string): string {
    const maxLength = 500; // 限制响应内容长度
    let sanitized = responseBody.length > maxLength ? responseBody.substring(0, maxLength) + '...[截断]' : responseBody;

    // 移除敏感信息
    sanitized = sanitized
      .replace(/("token"|"password"|"auth"|"key")\s*:\s*"[^"]+"/gi, '"$1": "***"')
      .replace(/authorization:\s*[^\s,}]+/gi, 'authorization: ***')
      .replace(/bearer\s+[^\s,}]+/gi, 'bearer ***');

    return sanitized;
  }
}

/**
 * 默认的发布日志记录器实例
 */
export const publishLogger = new PublishLogger();
