/**
 * 包管理器 - 协调扫描、检查、上传流程
 * 实现并发控制和任务调度，集成错误处理和进度跟踪
 */

import type { GeneralProgressTracker } from './progress-tracker.ts';
import { FastGlobPackageScanner } from './package-scanner.ts';
import { RegistryPackageChecker } from './package-checker.ts';
import { FetchPackageUploader } from './package-uploader.ts';
import { TarPackageInfoExtractor } from './package-info-extractor.ts';
import { createProgressTracker } from './progress-tracker.ts';
import { DefaultTaskFileTracker, generatePackageKey } from './task-file-tracker.ts';
import { logger } from '@/utils/logger.ts';
import { asyncFn } from '@/utils/task.ts';
import { createProgressBar } from '@/utils/progress-bar.ts';
import { createProgressLogger } from '@/utils/progress-logger.ts';
import type {
  DetailedProgressReport,
  OperationResult,
  PackageChecker,
  PackageInfo,
  PackageInfoExtractor,
  PackageManager,
  PackageScanner,
  PackageUploader,
  ProgressReport,
  PublishConfig,
  PublishTask,
  TaskExecutionStats,
} from '@/types/index.ts';
import { LogLevel, PackageStatus } from '@/types/index.ts';

/**
 * 包管理器内部配置（所有字段已填充默认值）
 */
interface ResolvedPublishConfig {
  publishDir: string;
  publishRegistry: string;
  publishAuth: string;
  threadNumber: number;
  logLevel: LogLevel;
  scanPattern: string;
  requestTimeout: number;
  taskFilePath?: string;
}

/**
 * 包管理器实现类
 */
export class DefaultPackageManager implements PackageManager {
  private readonly config: ResolvedPublishConfig;
  private readonly scanner: PackageScanner;
  private readonly checker: PackageChecker;
  private readonly uploader: PackageUploader;
  private readonly extractor: PackageInfoExtractor;
  private readonly progressTracker: GeneralProgressTracker;
  private readonly progressLogger = createProgressLogger(logger);
  private readonly taskFileTracker: DefaultTaskFileTracker | null = null;

  constructor(config: PublishConfig) {
    // 设置默认配置
    this.config = {
      publishDir: config.publishDir,
      publishRegistry: config.publishRegistry,
      publishAuth: config.publishAuth,
      threadNumber: config.threadNumber,
      logLevel: config.logLevel ?? LogLevel.INFO,
      scanPattern: config.scanPattern ?? '**/*.tgz',
      requestTimeout: config.requestTimeout ?? 300000, // 5分钟
      ...(config.taskFilePath !== undefined && { taskFilePath: config.taskFilePath }),
    };

    // 初始化组件
    this.scanner = new FastGlobPackageScanner();
    this.checker = new RegistryPackageChecker({
      requestTimeout: this.config.requestTimeout,
      auth: this.config.publishAuth,
    });
    this.uploader = new FetchPackageUploader({
      requestTimeout: this.config.requestTimeout,
    });
    this.extractor = new TarPackageInfoExtractor();
    this.progressTracker = createProgressTracker();

    // 初始化任务文件跟踪器
    if (this.config.taskFilePath) {
      this.taskFileTracker = new DefaultTaskFileTracker();
    }

    logger.debug('包管理器初始化完成', {
      publishDir: this.config.publishDir,
      publishRegistry: this.config.publishRegistry,
      threadNumber: this.config.threadNumber,
      taskFilePath: this.config.taskFilePath,
    });
  }

  /**
   * 执行完整的发布流程
   * @returns 操作结果
   */
  async publishPackages(): Promise<OperationResult> {
    const startTime = Date.now();

    try {
      // 初始化任务文件跟踪器
      if (this.taskFileTracker && this.config.taskFilePath) {
        await this.taskFileTracker.initialize(this.config.taskFilePath);
      }

      // 阶段1: 扫描包文件（使用缓存跳过已处理包，避免重复解析.tgz）
      const scanStartTime = Date.now();
      const packageInfoList = await this.scanAndExtractPackages(this.config.publishDir);
      const scanElapsedTime = Date.now() - scanStartTime;

      if (packageInfoList.length === 0) {
        logger.warn('未找到任何待处理的.tgz包文件', { publishDir: this.config.publishDir });
        return { success: 0, failed: [] };
      }

      // 初始化进度跟踪器
      this.progressTracker.initialize(packageInfoList);

      // 更新所有包的扫描完成状态
      for (const packageInfo of packageInfoList) {
        this.progressTracker.updateProgress(packageInfo.filePath, PackageStatus.SCANNING, {
          statusDetail: '包信息提取完成',
        });
      }

      // 阶段2: 检查包存在性
      const checkStartTime = Date.now();
      const publishTasks = await this.checkPackageExistence(packageInfoList, this.config);
      const checkElapsedTime = Date.now() - checkStartTime;

      // 阶段3: 执行上传任务
      const uploadStartTime = Date.now();
      const result = await this.executeUploadTasks(publishTasks, this.config);
      const uploadElapsedTime = Date.now() - uploadStartTime;

      // 标记已处理的包：成功上传的 + 远端已存在的
      if (this.taskFileTracker) {
        for (const task of publishTasks) {
          const key = generatePackageKey(task.packageInfo.packageName, task.packageInfo.version);
          if (task.uploadResult?.success || !task.needsUpload) {
            this.taskFileTracker.markAsProcessed(key);
          }
        }
        await this.taskFileTracker.save();
      }

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
      logger.error('包发布流程执行失败', { error: errorMessage });

      return {
        success: 0,
        failed: [`发布流程执行失败: ${errorMessage}`],
      };
    }
  }

  /**
   * 扫描并提取包信息
   *
   * 优化策略：
   * 1. 扫描所有 .tgz 文件
   * 2. 对于已处理的包（任务文件记录），直接跳过，不解析 .tgz
   * 3. 对于缓存中有包信息的包，直接使用缓存，不解析 .tgz
   * 4. 仅对未缓存的包执行 tar 解析，并将结果写入缓存
   */
  private async scanAndExtractPackages(publishDir: string): Promise<PackageInfo[]> {
    logger.debug('开始扫描包文件', { publishDir });

    try {
      const tgzFiles = await this.scanner.scanPackages(publishDir);
      logger.info(`扫描到 ${tgzFiles.length} 个.tgz文件`);

      if (tgzFiles.length === 0) {
        return [];
      }

      // 分类：已处理(跳过) / 缓存命中(无需解析) / 未缓存(需要解析)
      const toExtract: string[] = [];
      const cachedInfos: PackageInfo[] = [];
      let skippedProcessed = 0;

      for (const filePath of tgzFiles) {
        // 检查缓存
        const cached = this.taskFileTracker?.getCachedPackageInfo(filePath);
        if (cached) {
          // 缓存命中，检查是否已处理
          const key = generatePackageKey(cached.packageName, cached.version);
          if (this.taskFileTracker?.isProcessed(key)) {
            skippedProcessed++;
            continue;
          }
          // 未处理，使用缓存信息
          cachedInfos.push(cached);
          continue;
        }
        // 未缓存，需要解析
        toExtract.push(filePath);
      }

      if (skippedProcessed > 0) {
        logger.info(`跳过 ${skippedProcessed} 个已处理的包（使用缓存，无需解析.tgz）`);
      }
      if (cachedInfos.length > 0) {
        logger.info(`从缓存加载 ${cachedInfos.length} 个包信息（无需解析.tgz）`);
      }
      logger.info(`需要解析 ${toExtract.length} 个.tgz文件`);

      // 对未缓存的文件执行 tar 解析
      if (toExtract.length > 0) {
        const extractProgressBar = createProgressBar({
          title: 'Scanning',
          total: toExtract.length,
          enableColor: true,
          barWidth: 40,
          enableLogging: true,
        });
        extractProgressBar.start();
        this.progressLogger.setProgressBar(extractProgressBar);

        await asyncFn(
          toExtract,
          async (filePath: string) => {
            const packageInfo = await this.extractor.extractPackageInfo(filePath);
            if (packageInfo) {
              cachedInfos.push(packageInfo);
              // 写入缓存
              this.taskFileTracker?.setCachedPackageInfo(filePath, packageInfo);
            } else {
              this.progressLogger.warn(`无法提取包信息: ${filePath}`);
            }
            extractProgressBar.increment();
          },
          Math.min(this.config.threadNumber, 10)
        );

        extractProgressBar.stop();
        this.progressLogger.clearProgressBar();
      }

      logger.info(`共 ${cachedInfos.length} 个包待处理`);
      return cachedInfos;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('扫描包文件失败', { error: errorMessage, publishDir });
      throw new Error(`扫描包文件失败: ${errorMessage}`);
    }
  }

  /**
   * 检查包存在性
   */
  private async checkPackageExistence(
    packageInfoList: PackageInfo[],
    config: ResolvedPublishConfig
  ): Promise<PublishTask[]> {
    const publishTasks: PublishTask[] = [];

    logger.debug('开始检查包存在性', { totalPackages: packageInfoList.length });

    const checkProgressBar = createProgressBar({
      title: 'Checking',
      total: packageInfoList.length,
      enableColor: true,
      barWidth: 40,
      enableLogging: true,
    });
    checkProgressBar.start();

    this.progressLogger.setProgressBar(checkProgressBar);

    await asyncFn(
      packageInfoList,
      async (packageInfo: PackageInfo) => {
        this.progressTracker.updateProgress(packageInfo.filePath, PackageStatus.CHECKING, {
          statusDetail: '检查包是否已存在',
        });

        try {
          const exists = await this.checker.checkPackageExists(
            packageInfo.packageName,
            packageInfo.version,
            config.publishRegistry
          );

          const needsUpload = !exists;
          publishTasks.push({
            packageInfo,
            needsUpload,
          });

          if (exists) {
            this.progressTracker.updateProgress(packageInfo.filePath, PackageStatus.SKIPPED, {
              needsUpload: false,
              statusDetail: '包已存在，跳过上传',
            });
          } else {
            this.progressTracker.updateProgress(packageInfo.filePath, PackageStatus.CHECKING, {
              needsUpload: true,
              statusDetail: '包不存在，需要上传',
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.progressLogger.error(`检查包存在性失败: ${packageInfo.packageName}`, { error: errorMessage });

          publishTasks.push({
            packageInfo,
            needsUpload: true,
          });

          this.progressTracker.updateProgress(packageInfo.filePath, PackageStatus.FAILED, {
            error: `检查存在性失败: ${errorMessage}`,
            needsUpload: true,
          });
        }

        checkProgressBar.increment();
      },
      this.config.threadNumber
    );

    checkProgressBar.stop();
    this.progressLogger.clearProgressBar();

    const packagesNeedingUpload = publishTasks.filter((task) => task.needsUpload).length;
    const packagesSkipped = publishTasks.length - packagesNeedingUpload;

    logger.info('包存在性检查完成', {
      totalPackages: publishTasks.length,
      needsUpload: packagesNeedingUpload,
      skipped: packagesSkipped,
    });

    return publishTasks;
  }

  /**
   * 执行上传任务
   */
  private async executeUploadTasks(
    publishTasks: PublishTask[],
    config: ResolvedPublishConfig
  ): Promise<OperationResult> {
    const tasksNeedingUpload = publishTasks.filter((task) => task.needsUpload);

    if (tasksNeedingUpload.length === 0) {
      logger.info('没有需要上传的包');
      return { success: 0, failed: [] };
    } else {
      logger.info(`有${tasksNeedingUpload.length}个需要上传的包`);
    }

    logger.debug('开始执行上传任务', { totalTasks: tasksNeedingUpload.length });

    const uploadProgressBar = createProgressBar({
      title: 'Uploading',
      total: tasksNeedingUpload.length,
      enableColor: true,
      barWidth: 40,
      enableLogging: true,
    });
    uploadProgressBar.start();

    this.progressLogger.setProgressBar(uploadProgressBar);

    const result: OperationResult = {
      success: 0,
      failed: [],
    };

    await asyncFn(
      tasksNeedingUpload,
      async (task: PublishTask) => {
        const { packageInfo } = task;

        this.progressTracker.updateProgress(packageInfo.filePath, PackageStatus.UPLOADING, {
          statusDetail: '正在上传包文件',
        });

        try {
          const uploadResult = await this.uploader.uploadPackage(
            packageInfo.filePath,
            config.publishRegistry,
            config.publishAuth
          );

          task.uploadResult = uploadResult;

          if (uploadResult.success) {
            result.success++;
            this.progressTracker.updateProgress(packageInfo.filePath, PackageStatus.COMPLETED, {
              statusDetail: '上传成功',
              ...(uploadResult.statusCode !== undefined && { statusCode: uploadResult.statusCode }),
            });
          } else {
            const errorMsg = `上传失败 ${packageInfo.packageName} - ${uploadResult.error}`;
            result.failed.push(errorMsg);

            this.progressTracker.updateProgress(packageInfo.filePath, PackageStatus.FAILED, {
              ...(uploadResult.error && { error: uploadResult.error }),
              ...(uploadResult.statusCode !== undefined && { statusCode: uploadResult.statusCode }),
              statusDetail: '上传失败',
            });

            this.progressLogger.error('包上传失败', {
              packageName: packageInfo.packageName,
              error: uploadResult.error,
              statusCode: uploadResult.statusCode,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorMsg = `上传异常 ${packageInfo.packageName} - ${errorMessage}`;
          result.failed.push(errorMsg);

          this.progressTracker.updateProgress(packageInfo.filePath, PackageStatus.FAILED, {
            error: errorMessage,
            statusDetail: '上传异常',
          });

          this.progressLogger.error('包上传异常', {
            packageName: packageInfo.packageName,
            error: errorMessage,
          });
        }

        uploadProgressBar.increment();
      },
      this.config.threadNumber
    );

    uploadProgressBar.stop();
    this.progressLogger.clearProgressBar();

    logger.info('上传任务执行完成', {
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
    const allPackages = this.progressTracker.getAllPackageInfo();
    let actualSuccessfulUploads = 0;
    let actualFailedPackages = 0;
    let actualSkippedPackages = 0;

    for (const packageInfo of allPackages) {
      if (packageInfo.status === PackageStatus.COMPLETED) {
        actualSuccessfulUploads++;
      } else if (packageInfo.status === PackageStatus.SKIPPED) {
        actualSkippedPackages++;
      } else if (packageInfo.status === PackageStatus.FAILED) {
        actualFailedPackages++;
      }
    }

    const finalReport = this.progressTracker.generateFinalReport();
    logger.info('\n' + finalReport + '\n');

    const finish = [
      '=== 各阶段耗时 ===',
      `扫描阶段: ${Math.round(stats.phaseTimings.scanning / 1000)}秒`,
      `检查阶段: ${Math.round(stats.phaseTimings.checking / 1000)}秒`,
      `上传阶段: ${Math.round(stats.phaseTimings.uploading / 1000)}秒`,
      '',
      '=== 包发布完成报告 ===',
      `总包数: ${stats.totalPackages}`,
      `扫描到的包: ${stats.scannedPackages}`,
      `需要上传: ${stats.packagesNeedingUpload}`,
      `成功上传: ${actualSuccessfulUploads}`,
      `失败: ${actualFailedPackages}`,
      `跳过（已存在）: ${actualSkippedPackages}`,
      `总耗时: ${Math.round(stats.totalElapsedTime / 1000)}秒`,
    ].join('\n');

    logger.info('\n' + finish);
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
export function createPackageManager(config: PublishConfig): PackageManager {
  return new DefaultPackageManager(config);
}
