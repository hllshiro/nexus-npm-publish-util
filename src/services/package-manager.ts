/**
 * 包管理器 - 协调扫描、检查、上传流程
 * 实现并发控制和任务调度，集成错误处理和进度跟踪
 */

import type {
  PackageManager,
  PackageInfo,
  PublishTask,
  PackageScanner,
  PackageChecker,
  PackageUploader,
  PackageInfoExtractor,
} from '@/types/package.js';
import type { OptimizedPublishConfig, OperationResult } from '@/types/config.js';
import type { GeneralProgressTracker, DetailedProgressReport } from './progress-tracker.js';
import type { ProgressReport } from '@/types/error.js';
import { FastGlobPackageScanner } from './package-scanner.js';
import { RegistryPackageChecker } from './package-checker.js';
import { FetchPackageUploader } from './package-uploader.js';
import { TarPackageInfoExtractor } from './package-info-extractor.js';
import { createProgressTracker } from './progress-tracker.js';
import { enhancedLogger } from '@/utils/enhanced-logger.js';
import { LogLevel } from '@/types/logger.js';
import { asyncFn } from '@/utils/task.js';

/**
 * 包管理器配置接口
 */
export interface PackageManagerConfig {
  /** 发布目录 */
  publishDir: string;
  /** 发布URL */
  publishUrl: string;
  /** 认证信息 */
  publishAuth: string;
  /** 线程数 */
  threadNumber: number;
  /** 文件扫描模式，默认为递归扫描 */
  scanPattern?: string;
  /** HTTP请求超时时间（毫秒） */
  requestTimeout?: number;
  /** 连接超时时间（毫秒） */
  connectTimeout?: number;
  /** 是否启用详细日志记录 */
  enableDetailedLogging?: boolean;
  /** 最大并发数，默认使用threadNumber */
  maxConcurrency?: number;
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
 * 包管理器实现类
 */
export class DefaultPackageManager implements PackageManager {
  private readonly config: Required<PackageManagerConfig>;
  private readonly scanner: PackageScanner;
  private readonly checker: PackageChecker;
  private readonly uploader: PackageUploader;
  private readonly extractor: PackageInfoExtractor;
  private readonly progressTracker: GeneralProgressTracker;

  constructor(config: PackageManagerConfig) {
    // 设置默认配置
    this.config = {
      publishDir: config.publishDir,
      publishUrl: config.publishUrl,
      publishAuth: config.publishAuth,
      threadNumber: config.threadNumber,
      scanPattern: config.scanPattern ?? '**/*.tgz',
      requestTimeout: config.requestTimeout ?? 300000, // 5分钟
      connectTimeout: config.connectTimeout ?? 30000, // 30秒
      enableDetailedLogging: config.enableDetailedLogging ?? false,
      maxConcurrency: config.maxConcurrency ?? config.threadNumber,
    };

    // 初始化组件
    this.scanner = new FastGlobPackageScanner();
    this.checker = new RegistryPackageChecker({
      connectTimeout: this.config.connectTimeout,
      requestTimeout: this.config.requestTimeout,
    });
    this.uploader = new FetchPackageUploader({
      requestTimeout: this.config.requestTimeout,
      connectTimeout: this.config.connectTimeout,
      enableDetailedLogging: this.config.enableDetailedLogging,
      userAgent: 'publish-util/1.0.0',
    });
    this.extractor = new TarPackageInfoExtractor();
    this.progressTracker = createProgressTracker(this.config.enableDetailedLogging);

    enhancedLogger.info('包管理器初始化完成', {
      publishDir: this.config.publishDir,
      publishUrl: this.config.publishUrl,
      maxConcurrency: this.config.maxConcurrency,
    });
  }

  /**
   * 执行完整的发布流程
   * @param config 发布配置（可选，用于覆盖构造函数配置）
   * @returns 操作结果
   */
  async publishPackages(config?: OptimizedPublishConfig): Promise<OperationResult> {
    const startTime = Date.now();
    const effectiveConfig = config ? { ...this.config, ...config } : this.config;

    enhancedLogger.info('开始执行包发布流程', {
      publishDir: effectiveConfig.publishDir,
      publishUrl: effectiveConfig.publishUrl,
      maxConcurrency: effectiveConfig.maxConcurrency,
    });

    try {
      // 阶段1: 扫描包文件
      const scanStartTime = Date.now();
      const packageInfoList = await this.scanAndExtractPackages(effectiveConfig.publishDir);
      const scanElapsedTime = Date.now() - scanStartTime;

      if (packageInfoList.length === 0) {
        enhancedLogger.warn('未找到任何.tgz包文件', { publishDir: effectiveConfig.publishDir });
        return { success: 0, failed: [] };
      }

      // 初始化进度跟踪器
      this.progressTracker.initialize(packageInfoList);

      // 阶段2: 检查包存在性（如果未跳过）
      const checkStartTime = Date.now();
      const publishTasks = await this.checkPackageExistence(packageInfoList, effectiveConfig);
      const checkElapsedTime = Date.now() - checkStartTime;

      // 阶段3: 执行上传任务
      const uploadStartTime = Date.now();
      const result = await this.executeUploadTasks(publishTasks, effectiveConfig);
      const uploadElapsedTime = Date.now() - uploadStartTime;

      // 生成执行统计
      const totalElapsedTime = Date.now() - startTime;
      const stats = this.generateExecutionStats(packageInfoList, publishTasks, result, totalElapsedTime, {
        scanning: scanElapsedTime,
        checking: checkElapsedTime,
        uploading: uploadElapsedTime,
      });

      // 记录最终报告
      this.logFinalReport(stats);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      enhancedLogger.error('包发布流程执行失败', { error: errorMessage });

      return {
        success: 0,
        failed: [`发布流程执行失败: ${errorMessage}`],
      };
    }
  }

  /**
   * 扫描并提取包信息
   * @param publishDir 发布目录
   * @returns 包信息列表
   */
  private async scanAndExtractPackages(publishDir: string): Promise<PackageInfo[]> {
    enhancedLogger.info('开始扫描包文件', { publishDir });

    try {
      // 扫描.tgz文件
      const tgzFiles = await this.scanner.scanPackages(publishDir);
      enhancedLogger.info(`扫描到 ${tgzFiles.length} 个.tgz文件`);

      if (tgzFiles.length === 0) {
        return [];
      }

      // 提取包信息
      const packageInfoList: PackageInfo[] = [];

      // 使用并发控制提取包信息
      await asyncFn(
        tgzFiles,
        async (filePath: string) => {
          this.progressTracker.updateProgress(this.extractPackageNameFromPath(filePath), 'scanning', {
            statusDetail: '正在提取包信息',
          });

          const packageInfo = await this.extractor.extractPackageInfo(filePath);
          if (packageInfo) {
            packageInfoList.push(packageInfo);

            if (this.config.enableDetailedLogging) {
              enhancedLogger.logStructured(LogLevel.DEBUG, {
                message: '成功提取包信息',
                operation: 'package_info_extraction',
                packageName: packageInfo.packageName,
                metadata: {
                  version: packageInfo.version,
                  filePath: packageInfo.filePath,
                  fileName: packageInfo.fileName,
                },
              });
            }
          } else {
            enhancedLogger.warn(`无法提取包信息: ${filePath}`);
          }
        },
        Math.min(this.config.maxConcurrency, 10) // 限制并发数，避免文件系统过载
      );

      enhancedLogger.info(`成功提取 ${packageInfoList.length} 个包的信息`);
      return packageInfoList;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      enhancedLogger.error('扫描包文件失败', { error: errorMessage, publishDir });
      throw new Error(`扫描包文件失败: ${errorMessage}`);
    }
  }

  /**
   * 检查包存在性
   * @param packageInfoList 包信息列表
   * @param config 配置
   * @returns 发布任务列表
   */
  private async checkPackageExistence(
    packageInfoList: PackageInfo[],
    config: Required<PackageManagerConfig>
  ): Promise<PublishTask[]> {
    const publishTasks: PublishTask[] = [];

    enhancedLogger.info('开始检查包存在性', { totalPackages: packageInfoList.length });

    // 使用并发控制检查包存在性
    await asyncFn(
      packageInfoList,
      async (packageInfo: PackageInfo) => {
        this.progressTracker.updateProgress(packageInfo.packageName, 'checking', { statusDetail: '检查包是否已存在' });

        try {
          const exists = await this.checker.checkPackageExists(
            packageInfo.packageName,
            packageInfo.version,
            config.publishUrl
          );

          const needsUpload = !exists;
          publishTasks.push({
            packageInfo,
            needsUpload,
          });

          this.progressTracker.updateProgress(packageInfo.packageName, 'checking', {
            needsUpload,
            statusDetail: exists ? '包已存在，跳过上传' : '包不存在，需要上传',
          });

          if (this.config.enableDetailedLogging) {
            enhancedLogger.logStructured(LogLevel.DEBUG, {
              message: '包存在性检查完成',
              operation: 'package_existence_check',
              packageName: packageInfo.packageName,
              metadata: {
                version: packageInfo.version,
                exists,
                needsUpload,
              },
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          enhancedLogger.error(`检查包存在性失败: ${packageInfo.packageName}`, { error: errorMessage });

          // 检查失败时，默认需要上传
          publishTasks.push({
            packageInfo,
            needsUpload: true,
          });

          this.progressTracker.updateProgress(packageInfo.packageName, 'failed', {
            error: `检查存在性失败: ${errorMessage}`,
            needsUpload: true,
          });
        }
      },
      this.config.maxConcurrency
    );

    const packagesNeedingUpload = publishTasks.filter((task) => task.needsUpload).length;
    const packagesSkipped = publishTasks.length - packagesNeedingUpload;

    enhancedLogger.info('包存在性检查完成', {
      totalPackages: publishTasks.length,
      needsUpload: packagesNeedingUpload,
      skipped: packagesSkipped,
    });

    return publishTasks;
  }

  /**
   * 执行上传任务
   * @param publishTasks 发布任务列表
   * @param config 配置
   * @returns 操作结果
   */
  private async executeUploadTasks(
    publishTasks: PublishTask[],
    config: Required<PackageManagerConfig>
  ): Promise<OperationResult> {
    const tasksNeedingUpload = publishTasks.filter((task) => task.needsUpload);

    if (tasksNeedingUpload.length === 0) {
      enhancedLogger.info('没有需要上传的包');
      return { success: 0, failed: [] };
    }

    enhancedLogger.info('开始执行上传任务', { totalTasks: tasksNeedingUpload.length });

    const result: OperationResult = {
      success: 0,
      failed: [],
    };

    // 使用并发控制执行上传
    await asyncFn(
      tasksNeedingUpload,
      async (task: PublishTask) => {
        const { packageInfo } = task;

        this.progressTracker.updateProgress(packageInfo.packageName, 'uploading', { statusDetail: '正在上传包文件' });

        try {
          const uploadResult = await this.uploader.uploadPackage(
            packageInfo.filePath,
            config.publishUrl,
            config.publishAuth
          );

          task.uploadResult = uploadResult;

          if (uploadResult.success) {
            result.success++;
            this.progressTracker.updateProgress(packageInfo.packageName, 'completed', {
              statusDetail: '上传成功',
              ...(uploadResult.statusCode !== undefined && { statusCode: uploadResult.statusCode }),
            });

            if (this.config.enableDetailedLogging) {
              enhancedLogger.logStructured(LogLevel.INFO, {
                message: '包上传成功',
                operation: 'package_upload_success',
                packageName: packageInfo.packageName,
                metadata: {
                  version: packageInfo.version,
                  statusCode: uploadResult.statusCode,
                  fileName: packageInfo.fileName,
                },
              });
            }
          } else {
            const errorMsg = `上传失败 ${packageInfo.packageName} - ${uploadResult.error}`;
            result.failed.push(errorMsg);

            this.progressTracker.updateProgress(packageInfo.packageName, 'failed', {
              ...(uploadResult.error && { error: uploadResult.error }),
              ...(uploadResult.statusCode !== undefined && { statusCode: uploadResult.statusCode }),
              statusDetail: '上传失败',
            });

            enhancedLogger.error('包上传失败', {
              packageName: packageInfo.packageName,
              error: uploadResult.error,
              statusCode: uploadResult.statusCode,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorMsg = `上传异常 ${packageInfo.packageName} - ${errorMessage}`;
          result.failed.push(errorMsg);

          this.progressTracker.updateProgress(packageInfo.packageName, 'failed', {
            error: errorMessage,
            statusDetail: '上传异常',
          });

          enhancedLogger.error('包上传异常', {
            packageName: packageInfo.packageName,
            error: errorMessage,
          });
        }
      },
      this.config.maxConcurrency
    );

    enhancedLogger.info('上传任务执行完成', {
      totalTasks: tasksNeedingUpload.length,
      successful: result.success,
      failed: result.failed.length,
    });

    return result;
  }

  /**
   * 生成执行统计信息
   */
  private generateExecutionStats(
    packageInfoList: PackageInfo[],
    publishTasks: PublishTask[],
    result: OperationResult,
    totalElapsedTime: number,
    phaseTimings: { scanning: number; checking: number; uploading: number }
  ): TaskExecutionStats {
    const packagesNeedingUpload = publishTasks.filter((task) => task.needsUpload).length;
    const skippedPackages = publishTasks.length - packagesNeedingUpload;

    return {
      totalPackages: packageInfoList.length,
      scannedPackages: packageInfoList.length,
      packagesNeedingUpload,
      successfulUploads: result.success,
      failedPackages: result.failed.length,
      skippedPackages,
      totalElapsedTime,
      phaseTimings,
    };
  }

  /**
   * 记录最终报告
   */
  private logFinalReport(stats: TaskExecutionStats): void {
    const successRate =
      stats.totalPackages > 0 ? ((stats.successfulUploads / stats.totalPackages) * 100).toFixed(2) : '0.00';

    enhancedLogger.info('=== 包发布完成报告 ===');
    enhancedLogger.info(`总包数: ${stats.totalPackages}`);
    enhancedLogger.info(`扫描到的包: ${stats.scannedPackages}`);
    enhancedLogger.info(`需要上传: ${stats.packagesNeedingUpload}`);
    enhancedLogger.info(`成功上传: ${stats.successfulUploads}`);
    enhancedLogger.info(`失败: ${stats.failedPackages}`);
    enhancedLogger.info(`跳过（已存在）: ${stats.skippedPackages}`);
    enhancedLogger.info(`成功率: ${successRate}%`);
    enhancedLogger.info(`总耗时: ${Math.round(stats.totalElapsedTime / 1000)}秒`);

    if (this.config.enableDetailedLogging) {
      enhancedLogger.info('=== 各阶段耗时 ===');
      enhancedLogger.info(`扫描阶段: ${Math.round(stats.phaseTimings.scanning / 1000)}秒`);
      enhancedLogger.info(`检查阶段: ${Math.round(stats.phaseTimings.checking / 1000)}秒`);
      enhancedLogger.info(`上传阶段: ${Math.round(stats.phaseTimings.uploading / 1000)}秒`);
    }

    // 输出进度跟踪器的详细报告
    const finalReport = this.progressTracker.generateFinalReport();
    enhancedLogger.info('\n' + finalReport);
  }

  /**
   * 从文件路径提取包名（用于进度跟踪）
   */
  private extractPackageNameFromPath(filePath: string): string {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    return fileName.replace(/\.tgz$/, '');
  }

  /**
   * 获取当前进度报告
   */
  getProgressReport(): ProgressReport {
    return this.progressTracker.getProgressReport();
  }

  /**
   * 获取详细进度报告
   */
  getDetailedProgressReport(): DetailedProgressReport {
    return this.progressTracker.getDetailedProgressReport();
  }
}

/**
 * 创建包管理器实例
 */
export function createPackageManager(config: PackageManagerConfig): PackageManager {
  return new DefaultPackageManager(config);
}

/**
 * 默认包管理器实例工厂
 */
export const packageManagerFactory = {
  create: (config: PackageManagerConfig): PackageManager => new DefaultPackageManager(config),
};
