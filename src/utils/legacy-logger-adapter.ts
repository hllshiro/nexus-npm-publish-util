/**
 * 传统日志适配器 - 提供与现有日志接口的兼容性
 * 在保持现有日志格式的同时，添加新的结构化日志功能
 */

import { Logger } from './logger.js';
import { ProgressLogger } from './progress-logger.js';
import type { OperationResult } from '@/types/config.js';
import type { PackageInfo } from '@/types/package.js';

/**
 * 传统日志适配器类
 * 包装现有的Logger，添加进度跟踪和结构化日志功能
 */
export class LegacyLoggerAdapter {
  private baseLogger: Logger;
  private progressLogger: ProgressLogger;
  private enableEnhancedLogging: boolean;

  constructor(enableEnhancedLogging: boolean = true) {
    this.baseLogger = Logger.getInstance();
    this.progressLogger = new ProgressLogger({
      showDetailedProgress: enableEnhancedLogging,
      showPhaseStatistics: enableEnhancedLogging,
      showPerformanceMetrics: enableEnhancedLogging,
    });
    this.enableEnhancedLogging = enableEnhancedLogging;
  }

  /**
   * 基础日志方法 - 完全兼容现有接口
   */
  debug(message: string, data?: unknown): void {
    this.baseLogger.debug(message, data);
  }

  info(message: string, data?: unknown): void {
    this.baseLogger.info(message, data);
  }

  warn(message: string, data?: unknown): void {
    this.baseLogger.warn(message, data);
  }

  error(message: string, data?: unknown): void {
    this.baseLogger.error(message, data);
  }

  /**
   * 增强的发布流程日志方法
   */

  /**
   * 记录发布开始 - 兼容现有的 "开始发布" 日志
   */
  logPublishStart(config?: Record<string, unknown>): void {
    this.info('开始发布');

    if (this.enableEnhancedLogging && config) {
      this.progressLogger.logPublishStart(0, config);
    }
  }

  /**
   * 记录远程扫描开始 - 兼容现有格式
   */
  logRemoteScanStart(): void {
    this.info('扫描远程仓库(nexus仓库为单线程模型，获取时间与仓库大小有关)');

    if (this.enableEnhancedLogging) {
      this.progressLogger.logRemoteScanStart();
    }
  }

  /**
   * 记录远程扫描完成 - 兼容现有格式
   */
  logRemoteScanComplete(packageCount: number): void {
    this.info(`扫描结束，共获取到${packageCount}个包`);

    if (this.enableEnhancedLogging) {
      this.progressLogger.logRemoteScanComplete(packageCount);
    }
  }

  /**
   * 记录本地扫描开始 - 兼容现有格式
   */
  logLocalScanStart(): void {
    this.info('扫描待发布目录');

    if (this.enableEnhancedLogging) {
      this.progressLogger.logScanStart('');
    }
  }

  /**
   * 记录本地扫描完成 - 兼容现有格式
   */
  logLocalScanComplete(packageCount: number, packages?: PackageInfo[]): void {
    if (packageCount > 0) {
      this.info(`找到${packageCount}个待上传的包`);
      this.info('开始发布');
    } else {
      this.error('未找到待发布的包或全部存在于远端仓库');
    }

    if (this.enableEnhancedLogging && packages) {
      this.progressLogger.logScanComplete(packages);
    }
  }

  /**
   * 记录发布结果 - 兼容现有格式
   */
  logPublishResult(result: OperationResult, totalTime?: number): void {
    // 保持与现有格式完全兼容
    if (result.success > 0) {
      this.info(`成功(${result.success})`);
    }
    if (result.failed.length > 0) {
      this.error(`失败(${result.failed.length})`, result.failed.join('\n'));
    }

    if (this.enableEnhancedLogging && totalTime !== undefined) {
      this.progressLogger.logPublishComplete(result, totalTime);
    }
  }

  /**
   * 记录应用启动 - 兼容现有格式
   */
  logAppStart(): void {
    this.info(`调用开始: ${new Date().toISOString()}`);
    this.info(`用户指令: ${process.argv.join(' ')}`);
  }

  /**
   * 记录应用结束 - 兼容现有格式
   */
  logAppEnd(): void {
    this.info(`执行结束: ${new Date().toISOString()}`);
  }

  /**
   * 记录执行失败 - 兼容现有格式
   */
  logExecutionError(error: unknown): void {
    this.error('执行失败', error);
  }

  /**
   * 记录发布任务开始 - 兼容现有格式
   */
  logPublishTaskStart(config: {
    packageCount: number;
    workingDirectory: string;
    publishUrl: string;
    authFormat: string;
    concurrency: number;
  }): void {
    this.info('开始发布任务', config);

    if (this.enableEnhancedLogging) {
      this.progressLogger.logPublishStart(config.packageCount, config);
    }
  }

  /**
   * 记录发布任务完成 - 兼容现有格式
   */
  logPublishTaskComplete(summary: { total: number; success: number; failed: number; successRate: string }): void {
    this.info(`发布完成: ${JSON.stringify(summary)}`);
  }

  /**
   * 记录失败的包列表 - 兼容现有格式
   */
  logFailedPackages(failedPackages: string[]): void {
    if (failedPackages.length > 0) {
      this.error('失败的包列表:', failedPackages);
    }
  }

  /**
   * 增强功能方法（仅在启用增强日志时可用）
   */

  /**
   * 记录包检查进度
   */
  logPackageCheckProgress(current: number, total: number, packageName: string, exists: boolean): void {
    if (this.enableEnhancedLogging) {
      this.progressLogger.logPackageCheckProgress(current, total, packageName, exists);
    }
  }

  /**
   * 记录上传进度
   */
  logUploadProgress(current: number, total: number, packageName: string, success: boolean): void {
    if (this.enableEnhancedLogging) {
      this.progressLogger.logUploadProgress(current, total, packageName, success);
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
    if (this.enableEnhancedLogging) {
      this.progressLogger.logPerformanceStatistics(stats);
    }
  }

  /**
   * 记录错误汇总
   */
  logErrorSummary(errors: Array<{ packageName: string; error: string; phase: string }>): void {
    if (this.enableEnhancedLogging) {
      this.progressLogger.logErrorSummary(errors);
    }
  }

  /**
   * 获取进度日志记录器（用于高级功能）
   */
  getProgressLogger(): ProgressLogger {
    return this.progressLogger;
  }

  /**
   * 获取基础日志记录器（用于兼容性）
   */
  getBaseLogger(): Logger {
    return this.baseLogger;
  }

  /**
   * 启用或禁用增强日志功能
   */
  setEnhancedLogging(enabled: boolean): void {
    this.enableEnhancedLogging = enabled;
  }

  /**
   * 检查是否启用了增强日志功能
   */
  isEnhancedLoggingEnabled(): boolean {
    return this.enableEnhancedLogging;
  }
}

/**
 * 默认的传统日志适配器实例
 * 启用增强日志功能
 */
export const legacyLogger = new LegacyLoggerAdapter(true);

/**
 * 简化的传统日志适配器实例
 * 仅保持基础兼容性，不启用增强功能
 */
export const simpleLegacyLogger = new LegacyLoggerAdapter(false);

/**
 * 创建自定义配置的传统日志适配器
 */
export function createLegacyLoggerAdapter(enableEnhancedLogging: boolean = true): LegacyLoggerAdapter {
  return new LegacyLoggerAdapter(enableEnhancedLogging);
}
