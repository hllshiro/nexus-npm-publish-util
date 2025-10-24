/**
 * 进度日志记录器 - 提供与现有格式兼容的增强日志输出
 * 支持结构化日志记录和详细的操作状态信息
 */

import { EnhancedLogger } from './enhanced-logger.js';
import type { ProgressReport } from '@/types/error.js';
import type { PackageInfo } from '@/types/package.js';
import type { OperationResult } from '@/types/config.js';
import { LogLevel } from '@/types/logger.js';

/**
 * 详细进度报告接口（简化版本，避免循环依赖）
 */
export interface SimpleDetailedProgressReport extends ProgressReport {
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
 * 进度显示配置接口
 */
export interface ProgressDisplayConfig {
  /** 是否显示详细进度信息 */
  showDetailedProgress: boolean;
  /** 是否显示阶段统计 */
  showPhaseStatistics: boolean;
  /** 是否显示性能指标 */
  showPerformanceMetrics: boolean;
  /** 进度更新间隔（毫秒） */
  progressUpdateInterval: number;
  /** 是否使用彩色输出 */
  useColorOutput: boolean;
}

/**
 * 日志消息格式化器
 */
export class LogMessageFormatter {
  /**
   * 格式化包信息
   */
  static formatPackageInfo(packageInfo: PackageInfo): string {
    return `${packageInfo.packageName}@${packageInfo.version}`;
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * 格式化持续时间
   */
  static formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * 格式化百分比
   */
  static formatPercentage(current: number, total: number): string {
    if (total === 0) return '0.00%';
    return `${((current / total) * 100).toFixed(2)}%`;
  }

  /**
   * 格式化速率
   */
  static formatRate(rate: number, unit: string = 'items/s'): string {
    return `${rate.toFixed(2)} ${unit}`;
  }
}

/**
 * 进度日志记录器
 * 提供与现有格式兼容的增强日志输出
 */
export class ProgressLogger extends EnhancedLogger {
  private displayConfig: ProgressDisplayConfig;
  private lastProgressUpdate: number = 0;

  constructor(config: Partial<ProgressDisplayConfig> = {}) {
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

    this.displayConfig = {
      showDetailedProgress: config.showDetailedProgress ?? true,
      showPhaseStatistics: config.showPhaseStatistics ?? true,
      showPerformanceMetrics: config.showPerformanceMetrics ?? true,
      progressUpdateInterval: config.progressUpdateInterval ?? 1000,
      useColorOutput: config.useColorOutput ?? true,
      ...config,
    };
  }

  /**
   * 记录发布会话开始（兼容现有格式）
   */
  logPublishStart(totalPackages: number, config: Record<string, unknown>): void {
    // 保持与现有格式兼容的基础日志
    this.info('开始发布');

    // 添加详细的结构化日志
    if (this.displayConfig.showDetailedProgress) {
      this.logStructured(LogLevel.INFO, {
        message: `发布会话开始 - 共 ${totalPackages} 个包`,
        operation: 'publish_session_start',
        status: 'started',
        metadata: {
          totalPackages,
          config: this.sanitizeConfig(config),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * 记录扫描开始（兼容现有格式）
   */
  logScanStart(directory: string): void {
    // 保持与现有格式兼容
    this.info('扫描待发布目录');

    // 添加详细信息
    if (this.displayConfig.showDetailedProgress) {
      this.logStructured(LogLevel.INFO, {
        message: `开始扫描目录: ${directory}`,
        operation: 'directory_scan',
        status: 'started',
        metadata: { directory },
      });
    }
  }

  /**
   * 记录扫描完成（兼容现有格式）
   */
  logScanComplete(packages: PackageInfo[]): void {
    // 保持与现有格式兼容
    this.info(`找到${packages.length}个待上传的包`);

    // 添加详细信息
    if (this.displayConfig.showDetailedProgress) {
      this.logStructured(LogLevel.INFO, {
        message: `目录扫描完成 - 发现 ${packages.length} 个包`,
        operation: 'directory_scan',
        status: 'completed',
        metadata: {
          packagesFound: packages.length,
          packages: packages.map((p) => ({
            name: p.packageName,
            version: p.version,
            file: p.fileName,
            size: LogMessageFormatter.formatFileSize(0), // 文件大小将在后续获取
          })),
        },
      });
    }
  }

  /**
   * 记录远程仓库扫描开始（兼容现有格式）
   */
  logRemoteScanStart(): void {
    // 保持与现有格式兼容
    this.info('扫描远程仓库(nexus仓库为单线程模型，获取时间与仓库大小有关)');

    if (this.displayConfig.showDetailedProgress) {
      this.logStructured(LogLevel.INFO, {
        message: '开始扫描远程仓库',
        operation: 'remote_scan',
        status: 'started',
        metadata: {
          note: 'nexus仓库为单线程模型，获取时间与仓库大小有关',
        },
      });
    }
  }

  /**
   * 记录远程仓库扫描完成（兼容现有格式）
   */
  logRemoteScanComplete(packageCount: number): void {
    // 保持与现有格式兼容
    this.info(`扫描结束，共获取到${packageCount}个包`);

    if (this.displayConfig.showDetailedProgress) {
      this.logStructured(LogLevel.INFO, {
        message: `远程仓库扫描完成 - 发现 ${packageCount} 个已存在的包`,
        operation: 'remote_scan',
        status: 'completed',
        metadata: { remotePackageCount: packageCount },
      });
    }
  }

  /**
   * 记录包检查进度
   */
  logPackageCheckProgress(current: number, total: number, packageName: string, exists: boolean): void {
    const now = Date.now();

    // 控制进度更新频率
    if (now - this.lastProgressUpdate >= this.displayConfig.progressUpdateInterval) {
      const percentage = LogMessageFormatter.formatPercentage(current, total);
      const status = exists ? '已存在' : '需上传';

      // 兼容现有格式的简单进度显示
      this.info(`检查进度: ${current}/${total} (${percentage}) - ${packageName} [${status}]`);

      this.lastProgressUpdate = now;
    }

    // 详细的结构化日志
    if (this.displayConfig.showDetailedProgress) {
      this.logStructured(LogLevel.DEBUG, {
        message: `包存在性检查: ${packageName} - ${exists ? '已存在' : '需上传'}`,
        operation: 'package_check',
        packageName,
        status: 'completed',
        metadata: {
          exists,
          progress: { current, total, percentage: LogMessageFormatter.formatPercentage(current, total) },
        },
      });
    }
  }

  /**
   * 记录上传进度（兼容现有格式）
   */
  logUploadProgress(current: number, total: number, packageName: string, success: boolean): void {
    const percentage = LogMessageFormatter.formatPercentage(current, total);
    const status = success ? '成功' : '失败';

    // 保持与现有进度条格式兼容
    this.info(`[progress] [${this.generateProgressBar(current, total)}] ${percentage} ${packageName} [${status}]`);

    if (this.displayConfig.showDetailedProgress) {
      this.logStructured(LogLevel.INFO, {
        message: `包上传${status}: ${packageName}`,
        operation: 'package_upload',
        packageName,
        status: success ? 'completed' : 'failed',
        metadata: {
          progress: { current, total, percentage },
          success,
        },
      });
    }
  }

  /**
   * 记录发布完成（兼容现有格式）
   */
  logPublishComplete(result: OperationResult, totalTime: number): void {
    const total = result.success + result.failed.length;
    const successRate = LogMessageFormatter.formatPercentage(result.success, total);

    // 保持与现有格式兼容
    if (result.success > 0) {
      this.info(`成功(${result.success})`);
    }
    if (result.failed.length > 0) {
      this.error(`失败(${result.failed.length})`, result.failed.join('\n'));
    }

    // 添加详细的完成报告
    if (this.displayConfig.showDetailedProgress) {
      this.logStructured(LogLevel.INFO, {
        message: `发布完成 - 成功: ${result.success}, 失败: ${result.failed.length}, 成功率: ${successRate}`,
        operation: 'publish_session',
        status: 'completed',
        duration: totalTime,
        metadata: {
          summary: {
            total,
            successful: result.success,
            failed: result.failed.length,
            successRate,
            totalTime: LogMessageFormatter.formatDuration(totalTime),
          },
          failedPackages: result.failed,
        },
      });
    }
  }

  /**
   * 记录详细的进度报告
   */
  logDetailedProgress(report: SimpleDetailedProgressReport): void {
    if (!this.displayConfig.showDetailedProgress) return;

    const message = [
      `进度报告: ${report.uploadedPackages}/${report.totalPackages} 完成`,
      `(${LogMessageFormatter.formatPercentage(report.uploadedPackages, report.totalPackages)})`,
      `- 速率: ${LogMessageFormatter.formatRate(report.processingRate, 'packages/s')}`,
      `- 预计剩余: ${LogMessageFormatter.formatDuration(report.estimatedRemainingTime * 1000)}`,
    ].join(' ');

    this.info(message);

    // 性能指标
    if (this.displayConfig.showPerformanceMetrics) {
      this.logMetric('处理速率', report.processingRate, 'packages/s', {
        totalElapsed: LogMessageFormatter.formatDuration(report.totalElapsedTime),
        estimatedRemaining: LogMessageFormatter.formatDuration(report.estimatedRemainingTime * 1000),
      });
    }
  }

  /**
   * 记录错误统计
   */
  logErrorSummary(errors: Array<{ packageName: string; error: string; phase: string }>): void {
    if (errors.length === 0) return;

    this.error(`发现 ${errors.length} 个错误:`);

    // 按阶段分组错误
    const errorsByPhase = errors.reduce(
      (acc, error) => {
        if (!acc[error.phase]) {
          acc[error.phase] = [];
        }
        const phaseErrors = acc[error.phase];
        if (phaseErrors) {
          phaseErrors.push(error);
        }
        return acc;
      },
      {} as Record<string, typeof errors>
    );

    for (const [phase, phaseErrors] of Object.entries(errorsByPhase)) {
      if (phaseErrors) {
        this.error(`${phase} 阶段错误 (${phaseErrors.length}个):`);
        phaseErrors.forEach((error, index) => {
          this.error(`  ${index + 1}. ${error.packageName}: ${error.error}`);
        });
      }
    }

    // 结构化错误日志
    if (this.displayConfig.showDetailedProgress) {
      this.logStructured(LogLevel.ERROR, {
        message: `错误汇总: ${errors.length} 个错误`,
        operation: 'error_summary',
        metadata: {
          totalErrors: errors.length,
          errorsByPhase: Object.keys(errorsByPhase).map((phase) => ({
            phase,
            count: errorsByPhase[phase]?.length || 0,
            errors:
              errorsByPhase[phase]?.map((e) => ({
                package: e.packageName,
                error: e.error,
              })) || [],
          })),
        },
      });
    }
  }

  /**
   * 记录性能统计
   */
  logPerformanceStatistics(stats: {
    totalDuration: number;
    averagePackageTime: number;
    packagesPerSecond: number;
    networkTime?: number;
    fileIOTime?: number;
    concurrencyUtilization?: number;
  }): void {
    if (!this.displayConfig.showPerformanceMetrics) return;

    const performanceReport = [
      `性能统计:`,
      `总耗时: ${LogMessageFormatter.formatDuration(stats.totalDuration)}`,
      `平均每包: ${LogMessageFormatter.formatDuration(stats.averagePackageTime)}`,
      `处理速率: ${LogMessageFormatter.formatRate(stats.packagesPerSecond, 'packages/s')}`,
    ];

    if (stats.networkTime !== undefined) {
      performanceReport.push(`网络耗时: ${LogMessageFormatter.formatDuration(stats.networkTime)}`);
    }

    if (stats.fileIOTime !== undefined) {
      performanceReport.push(`文件IO: ${LogMessageFormatter.formatDuration(stats.fileIOTime)}`);
    }

    if (stats.concurrencyUtilization !== undefined) {
      performanceReport.push(`并发利用率: ${LogMessageFormatter.formatPercentage(stats.concurrencyUtilization, 1)}`);
    }

    this.info(performanceReport.join(', '));

    // 详细的性能指标日志
    this.logStructured(LogLevel.INFO, {
      message: '性能统计报告',
      operation: 'performance_statistics',
      metadata: {
        totalDuration: stats.totalDuration,
        averagePackageTime: stats.averagePackageTime,
        packagesPerSecond: stats.packagesPerSecond,
        networkTime: stats.networkTime,
        fileIOTime: stats.fileIOTime,
        concurrencyUtilization: stats.concurrencyUtilization,
        formattedStats: {
          totalDuration: LogMessageFormatter.formatDuration(stats.totalDuration),
          averagePackageTime: LogMessageFormatter.formatDuration(stats.averagePackageTime),
          packagesPerSecond: LogMessageFormatter.formatRate(stats.packagesPerSecond, 'packages/s'),
        },
      },
    });
  }

  /**
   * 生成进度条字符串（兼容现有格式）
   */
  private generateProgressBar(current: number, total: number, width: number = 40): string {
    if (total === 0) return ''.padEnd(width, ' ');

    const progress = current / total;
    const completed = Math.floor(progress * width);
    const remaining = width - completed;

    return '='.repeat(completed) + ' '.repeat(remaining);
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
}

/**
 * 默认的进度日志记录器实例
 */
export const progressLogger = new ProgressLogger({
  showDetailedProgress: true,
  showPhaseStatistics: true,
  showPerformanceMetrics: true,
  progressUpdateInterval: 1000,
  useColorOutput: true,
});

/**
 * 简化的进度日志记录器实例（仅基础信息）
 */
export const simpleProgressLogger = new ProgressLogger({
  showDetailedProgress: false,
  showPhaseStatistics: false,
  showPerformanceMetrics: false,
  progressUpdateInterval: 2000,
  useColorOutput: false,
});
