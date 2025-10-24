/**
 * 包管理器 - 协调扫描、检查、上传流程
 * 实现并发控制和任务调度，集成错误处理和进度跟踪
 */

import type { GeneralProgressTracker } from './progress-tracker.js';
import { FastGlobPackageScanner } from './package-scanner.js';
import { RegistryPackageChecker } from './package-checker.js';
import { FetchPackageUploader } from './package-uploader.js';
import { TarPackageInfoExtractor } from './package-info-extractor.js';
import { createProgressTracker } from './progress-tracker.js';
import { logger } from '@/utils/logger.js';
import { asyncFn } from '@/utils/task.js';
import ProgressBar from 'progress';
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
} from '@/types';
import { PackageStatus } from '@/types';

/**
 * 包管理器实现类
 */
export class DefaultPackageManager implements PackageManager {
  private readonly config: Required<PublishConfig>;
  private readonly scanner: PackageScanner;
  private readonly checker: PackageChecker;
  private readonly uploader: PackageUploader;
  private readonly extractor: PackageInfoExtractor;
  private readonly progressTracker: GeneralProgressTracker;

  constructor(config: PublishConfig) {
    // 设置默认配置
    this.config = {
      publishDir: config.publishDir,
      publishRegistry: config.publishRegistry,
      publishAuth: config.publishAuth,
      threadNumber: config.threadNumber,
      scanPattern: config.scanPattern ?? '**/*.tgz',
      requestTimeout: config.requestTimeout ?? 300000, // 5分钟
      connectTimeout: config.connectTimeout ?? 30000, // 30秒
      enableDetailedLogging: config.enableDetailedLogging ?? false,
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
    });
    this.extractor = new TarPackageInfoExtractor();
    this.progressTracker = createProgressTracker(this.config.enableDetailedLogging);

    logger.info('包管理器初始化完成', {
      publishDir: this.config.publishDir,
      publishRegistry: this.config.publishRegistry,
      threadNumber: this.config.threadNumber,
    });
  }

  /**
   * 执行完整的发布流程
   * @param config 发布配置（可选，用于覆盖构造函数配置）
   * @returns 操作结果
   */
  async publishPackages(): Promise<OperationResult> {
    const startTime = Date.now();

    logger.info('开始执行包发布流程', {
      publishDir: this.config.publishDir,
      publishRegistry: this.config.publishRegistry,
      threadNumber: this.config.threadNumber,
    });

    try {
      // 阶段1: 扫描包文件
      const scanStartTime = Date.now();
      const packageInfoList = await this.scanAndExtractPackages(this.config.publishDir);
      const scanElapsedTime = Date.now() - scanStartTime;

      if (packageInfoList.length === 0) {
        logger.warn('未找到任何.tgz包文件', { publishDir: this.config.publishDir });
        return { success: 0, failed: [] };
      }

      // 初始化进度跟踪器
      this.progressTracker.initialize(packageInfoList);

      // 更新所有包的扫描完成状态
      for (const packageInfo of packageInfoList) {
        this.progressTracker.updateProgress(packageInfo.filePath, 'scanning', {
          statusDetail: '包信息提取完成',
        });
      }

      // 阶段2: 检查包存在性（如果未跳过）
      const checkStartTime = Date.now();
      const publishTasks = await this.checkPackageExistence(packageInfoList, this.config);
      const checkElapsedTime = Date.now() - checkStartTime;

      // 阶段3: 执行上传任务
      const uploadStartTime = Date.now();
      const result = await this.executeUploadTasks(publishTasks, this.config);
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
      logger.error('包发布流程执行失败', { error: errorMessage });

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
    logger.info('开始扫描包文件', { publishDir });

    try {
      // 扫描.tgz文件
      const tgzFiles = await this.scanner.scanPackages(publishDir);
      logger.info(`扫描到 ${tgzFiles.length} 个.tgz文件`);

      if (tgzFiles.length === 0) {
        return [];
      }

      // 创建进度条 - 文件信息提取
      const extractProgressBar = new ProgressBar('提取包信息 [:bar] :current/:total :percent :etas', {
        complete: '█',
        incomplete: '░',
        width: 40,
        total: tgzFiles.length,
      });

      // 提取包信息
      const packageInfoList: PackageInfo[] = [];

      // 使用并发控制提取包信息
      await asyncFn(
        tgzFiles,
        async (filePath: string) => {
          const packageInfo = await this.extractor.extractPackageInfo(filePath);
          if (packageInfo) {
            packageInfoList.push(packageInfo);

            if (this.config.enableDetailedLogging) {
              logger.debug('成功提取包信息', {
                version: packageInfo.version,
                filePath: packageInfo.filePath,
                fileName: packageInfo.fileName,
              });
            }
          } else {
            logger.warn(`无法提取包信息: ${filePath}`);
          }

          // 更新进度条
          extractProgressBar.tick();
        },
        Math.min(this.config.threadNumber, 10) // 限制并发数，避免文件系统过载
      );

      logger.info(`成功提取 ${packageInfoList.length} 个包的信息`);
      return packageInfoList;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('扫描包文件失败', { error: errorMessage, publishDir });
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
    config: Required<PublishConfig>
  ): Promise<PublishTask[]> {
    const publishTasks: PublishTask[] = [];

    logger.info('开始检查包存在性', { totalPackages: packageInfoList.length });

    // 创建进度条 - 包检查
    const checkProgressBar = new ProgressBar('检查包存在性 [:bar] :current/:total :percent :etas', {
      complete: '█',
      incomplete: '░',
      width: 40,
      total: packageInfoList.length,
    });

    // 使用并发控制检查包存在性
    await asyncFn(
      packageInfoList,
      async (packageInfo: PackageInfo) => {
        this.progressTracker.updateProgress(packageInfo.filePath, 'checking', { statusDetail: '检查包是否已存在' });

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

          // 更新进度跟踪器状态
          if (exists) {
            // 包已存在，标记为跳过 - 使用特殊的skipped状态
            this.progressTracker.updateProgress(packageInfo.filePath, 'skipped', {
              needsUpload: false,
              statusDetail: '包已存在，跳过上传',
            });
          } else {
            // 包不存在，需要上传，但此时还未开始上传，保持checking状态
            this.progressTracker.updateProgress(packageInfo.filePath, 'checking', {
              needsUpload: true,
              statusDetail: '包不存在，需要上传',
            });
          }

          if (this.config.enableDetailedLogging) {
            logger.debug('包存在性检查完成', { version: packageInfo.version, exists, needsUpload });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`检查包存在性失败: ${packageInfo.packageName}`, { error: errorMessage });

          // 检查失败时，默认需要上传
          publishTasks.push({
            packageInfo,
            needsUpload: true,
          });

          this.progressTracker.updateProgress(packageInfo.filePath, 'failed', {
            error: `检查存在性失败: ${errorMessage}`,
            needsUpload: true,
          });
        }

        // 更新进度条
        checkProgressBar.tick();
      },
      this.config.threadNumber
    );

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
   * @param publishTasks 发布任务列表
   * @param config 配置
   * @returns 操作结果
   */
  private async executeUploadTasks(
    publishTasks: PublishTask[],
    config: Required<PublishConfig>
  ): Promise<OperationResult> {
    const tasksNeedingUpload = publishTasks.filter((task) => task.needsUpload);

    if (tasksNeedingUpload.length === 0) {
      logger.info('没有需要上传的包');
      return { success: 0, failed: [] };
    }

    logger.info('开始执行上传任务', { totalTasks: tasksNeedingUpload.length });

    // 创建进度条 - 包上传
    const uploadProgressBar = new ProgressBar('上传包文件 [:bar] :current/:total :percent :etas', {
      complete: '█',
      incomplete: '░',
      width: 40,
      total: tasksNeedingUpload.length,
    });

    const result: OperationResult = {
      success: 0,
      failed: [],
    };

    // 使用并发控制执行上传
    await asyncFn(
      tasksNeedingUpload,
      async (task: PublishTask) => {
        const { packageInfo } = task;

        this.progressTracker.updateProgress(packageInfo.filePath, 'uploading', { statusDetail: '正在上传包文件' });

        try {
          const uploadResult = await this.uploader.uploadPackage(
            packageInfo.filePath,
            config.publishRegistry,
            config.publishAuth
          );

          task.uploadResult = uploadResult;

          if (uploadResult.success) {
            result.success++;
            this.progressTracker.updateProgress(packageInfo.filePath, 'completed', {
              statusDetail: '上传成功',
              ...(uploadResult.statusCode !== undefined && { statusCode: uploadResult.statusCode }),
            });

            if (this.config.enableDetailedLogging) {
              logger.info('包上传成功', {
                version: packageInfo.version,
                statusCode: uploadResult.statusCode,
                fileName: packageInfo.fileName,
              });
            }
          } else {
            const errorMsg = `上传失败 ${packageInfo.packageName} - ${uploadResult.error}`;
            result.failed.push(errorMsg);

            this.progressTracker.updateProgress(packageInfo.filePath, 'failed', {
              ...(uploadResult.error && { error: uploadResult.error }),
              ...(uploadResult.statusCode !== undefined && { statusCode: uploadResult.statusCode }),
              statusDetail: '上传失败',
            });

            logger.error('包上传失败', {
              packageName: packageInfo.packageName,
              error: uploadResult.error,
              statusCode: uploadResult.statusCode,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorMsg = `上传异常 ${packageInfo.packageName} - ${errorMessage}`;
          result.failed.push(errorMsg);

          this.progressTracker.updateProgress(packageInfo.filePath, 'failed', {
            error: errorMessage,
            statusDetail: '上传异常',
          });

          logger.error('包上传异常', {
            packageName: packageInfo.packageName,
            error: errorMessage,
          });
        }

        // 更新进度条
        uploadProgressBar.tick();
      },
      this.config.threadNumber
    );

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
    // 从进度跟踪器获取准确的统计数据
    const allPackages = this.progressTracker.getAllPackageInfo();
    let actualSuccessfulUploads = 0;
    let actualFailedPackages = 0;
    let actualSkippedPackages = 0;

    for (const packageInfo of allPackages) {
      if (packageInfo.status === PackageStatus.COMPLETED) {
        // 包被成功上传
        actualSuccessfulUploads++;
      } else if (packageInfo.status === PackageStatus.SKIPPED) {
        // 包已存在，被跳过
        actualSkippedPackages++;
      } else if (packageInfo.status === PackageStatus.FAILED) {
        actualFailedPackages++;
      }
    }

    logger.info('=== 包发布完成报告 ===');
    logger.info(`总包数: ${stats.totalPackages}`);
    logger.info(`扫描到的包: ${stats.scannedPackages}`);
    logger.info(`需要上传: ${stats.packagesNeedingUpload}`);
    logger.info(`成功上传: ${actualSuccessfulUploads}`);
    logger.info(`失败: ${actualFailedPackages}`);
    logger.info(`跳过（已存在）: ${actualSkippedPackages}`);
    logger.info(`总耗时: ${Math.round(stats.totalElapsedTime / 1000)}秒`);

    if (this.config.enableDetailedLogging) {
      logger.info('=== 各阶段耗时 ===');
      logger.info(`扫描阶段: ${Math.round(stats.phaseTimings.scanning / 1000)}秒`);
      logger.info(`检查阶段: ${Math.round(stats.phaseTimings.checking / 1000)}秒`);
      logger.info(`上传阶段: ${Math.round(stats.phaseTimings.uploading / 1000)}秒`);
    }

    // 输出进度跟踪器的详细报告
    const finalReport = this.progressTracker.generateFinalReport();
    logger.info('\n' + finalReport);
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

/**
 * 默认包管理器实例工厂
 */
export const packageManagerFactory = {
  create: (config: PublishConfig): PackageManager => new DefaultPackageManager(config),
};
