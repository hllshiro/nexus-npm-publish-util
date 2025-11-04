/**
 * 通用进度跟踪器 - 跟踪扫描、检查、上传各阶段进度
 * 提供实时进度更新和详细的进度报告
 */

import {
  PackageStatus,
  type DetailedProgressReport,
  type PackageInfo,
  type PackageProcessInfo,
  type PhaseStatistics,
  type ProgressReport,
  type ProgressTracker,
} from '@/types/index.ts';
import { logger } from '@/utils/logger.ts';

/**
 * 通用进度跟踪器实现
 */
export class GeneralProgressTracker implements ProgressTracker {
  public total: number = 0;
  public completed: number = 0;
  public failed: number = 0;

  private packages: Map<string, PackageProcessInfo> = new Map();
  private startTime: Date = new Date();
  private currentOperation: string = '';

  /**
   * 初始化跟踪器
   * @param packages 要跟踪的包信息列表
   */
  initialize(packages: PackageInfo[]): void {
    this.total = packages.length;
    this.completed = 0;
    this.failed = 0;
    this.startTime = new Date();
    this.packages.clear();

    // 初始化所有包的状态 - 使用文件路径作为唯一key
    for (const packageInfo of packages) {
      this.packages.set(packageInfo.filePath, {
        packageInfo,
        status: PackageStatus.PENDING,
        phaseTimings: {},
      });
    }

    logger.debug('进度跟踪器初始化完成', {
      totalPackages: this.total,
      packages: packages.map((p) => ({ name: p.packageName, version: p.version })),
    });
  }

  /**
   * 更新包的进度状态
   * @param filePath 文件路径（作为唯一标识符）
   * @param status 状态
   * @param additionalInfo 额外信息
   */
  updateProgress(
    filePath: string,
    status: PackageStatus,
    additionalInfo?: {
      error?: string;
      statusCode?: number;
      needsUpload?: boolean;
      statusDetail?: string;
    }
  ): void {
    const packageStatus = status;
    const packageInfo = this.packages.get(filePath);

    if (!packageInfo) {
      logger.warn(`尝试更新未知包的进度: ${filePath}`);
      return;
    }

    const now = new Date();
    const updatedInfo: PackageProcessInfo = {
      ...packageInfo,
      status: packageStatus,
      statusDetail: additionalInfo?.statusDetail || status,
      ...(additionalInfo?.error !== undefined && { error: additionalInfo.error }),
      ...(additionalInfo?.statusCode !== undefined && { statusCode: additionalInfo.statusCode }),
      ...(additionalInfo?.needsUpload !== undefined && { needsUpload: additionalInfo.needsUpload }),
    };

    // 更新阶段时间记录
    this.updatePhaseTimings(updatedInfo, status, now);

    // 设置开始和结束时间
    if (!updatedInfo.startTime && packageStatus !== PackageStatus.PENDING) {
      updatedInfo.startTime = now;
    }

    if (
      (packageStatus === PackageStatus.COMPLETED ||
        packageStatus === PackageStatus.FAILED ||
        packageStatus === PackageStatus.SKIPPED) &&
      !updatedInfo.endTime
    ) {
      updatedInfo.endTime = now;
    }

    this.packages.set(filePath, updatedInfo);

    // 更新计数器
    this.updateCounters();

    // 更新当前操作描述
    this.currentOperation = this.generateCurrentOperationDescription(packageInfo.packageInfo.packageName, status);
  }

  /**
   * 更新阶段时间记录
   */
  private updatePhaseTimings(packageInfo: PackageProcessInfo, status: string, timestamp: Date): void {
    switch (status) {
      case 'scanning':
        packageInfo.phaseTimings.scanStart = timestamp;
        break;
      case 'checking':
        if (packageInfo.phaseTimings.scanStart && !packageInfo.phaseTimings.scanEnd) {
          packageInfo.phaseTimings.scanEnd = timestamp;
        }
        packageInfo.phaseTimings.checkStart = timestamp;
        break;
      case 'uploading':
        if (packageInfo.phaseTimings.checkStart && !packageInfo.phaseTimings.checkEnd) {
          packageInfo.phaseTimings.checkEnd = timestamp;
        }
        packageInfo.phaseTimings.uploadStart = timestamp;
        break;
      case 'completed':
      case 'failed':
        if (packageInfo.phaseTimings.uploadStart && !packageInfo.phaseTimings.uploadEnd) {
          packageInfo.phaseTimings.uploadEnd = timestamp;
        } else if (packageInfo.phaseTimings.checkStart && !packageInfo.phaseTimings.checkEnd) {
          packageInfo.phaseTimings.checkEnd = timestamp;
        } else if (packageInfo.phaseTimings.scanStart && !packageInfo.phaseTimings.scanEnd) {
          packageInfo.phaseTimings.scanEnd = timestamp;
        }
        break;
    }
  }

  /**
   * 更新计数器
   */
  private updateCounters(): void {
    this.completed = 0;
    this.failed = 0;

    for (const packageInfo of this.packages.values()) {
      if (packageInfo.status === PackageStatus.COMPLETED || packageInfo.status === PackageStatus.SKIPPED) {
        this.completed++;
      } else if (packageInfo.status === PackageStatus.FAILED) {
        this.failed++;
      }
    }
  }

  /**
   * 生成当前操作描述
   */
  private generateCurrentOperationDescription(packageName: string, status: string): string {
    const statusMap = {
      scanning: '扫描',
      checking: '检查',
      uploading: '上传',
      completed: '完成',
      failed: '失败',
      skipped: '跳过',
    };

    const statusText = statusMap[status as keyof typeof statusMap] || status;
    return `${statusText} ${packageName}`;
  }

  /**
   * 获取进度报告
   */
  getProgressReport(): ProgressReport {
    // 计算各种状态的包数量
    let scannedPackages = 0;
    let checkedPackages = 0;
    let uploadedPackages = 0;

    for (const packageInfo of this.packages.values()) {
      // 已扫描：状态不是PENDING
      if (packageInfo.status !== PackageStatus.PENDING) {
        scannedPackages++;
      }
      // 已检查：状态为UPLOADING、COMPLETED、FAILED或SKIPPED
      if (
        packageInfo.status === PackageStatus.UPLOADING ||
        packageInfo.status === PackageStatus.COMPLETED ||
        packageInfo.status === PackageStatus.FAILED ||
        packageInfo.status === PackageStatus.SKIPPED
      ) {
        checkedPackages++;
      }
      // 已上传：状态为COMPLETED
      if (packageInfo.status === PackageStatus.COMPLETED) {
        uploadedPackages++;
      }
    }

    return {
      totalPackages: this.total,
      scannedPackages,
      checkedPackages,
      uploadedPackages,
      failedPackages: this.failed,
      currentOperation: this.currentOperation,
    };
  }

  /**
   * 获取详细的进度报告
   */
  getDetailedProgressReport(): DetailedProgressReport {
    const basicReport = this.getProgressReport();
    const now = new Date();
    const totalElapsedTime = now.getTime() - this.startTime.getTime();

    // 计算处理速率
    const processedCount = this.completed + this.failed;
    const processingRate = processedCount > 0 ? processedCount / (totalElapsedTime / 1000) : 0;

    // 估算剩余时间
    const remainingCount = this.total - processedCount;
    const estimatedRemainingTime = processingRate > 0 ? Math.ceil(remainingCount / processingRate) : 0;

    // 计算各阶段统计
    const phaseStatistics = this.calculatePhaseStatistics();

    // 收集错误信息
    const errors: Array<{ packageName: string; error: string; phase: string }> = [];
    for (const packageInfo of this.packages.values()) {
      if (packageInfo.status === PackageStatus.FAILED && packageInfo.error) {
        errors.push({
          packageName: packageInfo.packageInfo.packageName,
          error: packageInfo.error,
          phase: this.determineFailurePhase(packageInfo),
        });
      }
    }

    return {
      ...basicReport,
      phaseStatistics,
      processingRate: Math.round(processingRate * 100) / 100,
      estimatedRemainingTime,
      totalElapsedTime,
      errors,
    };
  }

  /**
   * 计算各阶段统计信息
   */
  private calculatePhaseStatistics(): PhaseStatistics[] {
    const phases = ['scan', 'check', 'upload'];
    const statistics: PhaseStatistics[] = [];

    for (const phase of phases) {
      const phaseStats = this.calculateSinglePhaseStatistics(phase);
      statistics.push(phaseStats);
    }

    return statistics;
  }

  /**
   * 计算单个阶段的统计信息
   */
  private calculateSinglePhaseStatistics(phase: string): PhaseStatistics {
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    let totalTime = 0;
    let validTimings = 0;

    for (const packageInfo of this.packages.values()) {
      const timing = this.getPhaseTimingDuration(packageInfo, phase);

      if (this.hasCompletedPhase(packageInfo, phase)) {
        processed++;

        if (timing !== null) {
          totalTime += timing;
          validTimings++;
        }

        // 根据不同阶段和包状态来统计
        if (phase === 'scan') {
          // 扫描阶段：所有非PENDING的包都算成功
          if (packageInfo.status !== PackageStatus.PENDING) {
            successful++;
          }
        } else if (phase === 'check') {
          // 检查阶段：区分成功检查、跳过和失败
          if (packageInfo.status === PackageStatus.SKIPPED) {
            skipped++;
          } else if (packageInfo.status === PackageStatus.FAILED) {
            failed++;
          } else {
            successful++;
          }
        } else if (phase === 'upload') {
          // 上传阶段：只统计实际进入上传的包
          if (packageInfo.status === PackageStatus.COMPLETED) {
            successful++;
          } else if (packageInfo.status === PackageStatus.FAILED) {
            failed++;
          }
        }
      }
    }

    const averageTime = validTimings > 0 ? Math.round(totalTime / validTimings) : 0;

    return {
      phase,
      processed,
      successful,
      failed,
      skipped,
      averageTime,
      totalTime: Math.round(totalTime),
    };
  }

  /**
   * 获取阶段处理时长
   */
  private getPhaseTimingDuration(packageInfo: PackageProcessInfo, phase: string): number | null {
    const timings = packageInfo.phaseTimings;

    switch (phase) {
      case 'scan':
        if (timings.scanStart && timings.scanEnd) {
          return timings.scanEnd.getTime() - timings.scanStart.getTime();
        }
        break;
      case 'check':
        if (timings.checkStart && timings.checkEnd) {
          return timings.checkEnd.getTime() - timings.checkStart.getTime();
        }
        break;
      case 'upload':
        if (timings.uploadStart && timings.uploadEnd) {
          return timings.uploadEnd.getTime() - timings.uploadStart.getTime();
        }
        break;
    }

    return null;
  }

  /**
   * 检查包是否完成了指定阶段
   */
  private hasCompletedPhase(packageInfo: PackageProcessInfo, phase: string): boolean {
    switch (phase) {
      case 'scan':
        return packageInfo.status !== PackageStatus.PENDING;
      case 'check':
        return [PackageStatus.UPLOADING, PackageStatus.COMPLETED, PackageStatus.FAILED, PackageStatus.SKIPPED].includes(
          packageInfo.status
        );
      case 'upload':
        // 上传阶段：只有实际需要上传的包才算参与了这个阶段
        return (
          [PackageStatus.COMPLETED, PackageStatus.FAILED].includes(packageInfo.status) &&
          packageInfo.needsUpload !== false
        );
      default:
        return false;
    }
  }

  /**
   * 确定失败阶段
   */
  private determineFailurePhase(packageInfo: PackageProcessInfo): string {
    if (packageInfo.phaseTimings.uploadStart) {
      return 'upload';
    } else if (packageInfo.phaseTimings.checkStart) {
      return 'check';
    } else if (packageInfo.phaseTimings.scanStart) {
      return 'scan';
    }
    return 'unknown';
  }

  /**
   * 生成最终报告
   */
  generateFinalReport(): string {
    const detailedReport = this.getDetailedProgressReport();

    // 计算各种状态的包数量和收集明细
    let completedPackages = 0;
    let failedPackages = 0;
    let skippedPackages = 0;

    const completedList: string[] = [];
    const failedList: string[] = [];
    const skippedList: string[] = [];

    for (const packageInfo of this.packages.values()) {
      const packageName = packageInfo.packageInfo.packageName;
      const version = packageInfo.packageInfo.version;
      const fileName = packageInfo.packageInfo.fileName;

      if (packageInfo.status === PackageStatus.COMPLETED) {
        // 包被成功上传
        completedPackages++;
        completedList.push(`${packageName}@${version} (${fileName})`);
      } else if (packageInfo.status === PackageStatus.SKIPPED) {
        // 包已存在，被跳过
        skippedPackages++;
        skippedList.push(`${packageName}@${version} (${fileName})`);
      } else if (packageInfo.status === PackageStatus.FAILED) {
        failedPackages++;
        const errorMsg = packageInfo.error || '未知错误';
        failedList.push(`${packageName}@${version} (${fileName}) - ${errorMsg}`);
      }
    }

    const report = [
      '=== 发布完成报告 ===',
      `总包数: ${detailedReport.totalPackages}`,
      `成功上传: ${completedPackages}`,
      `失败: ${failedPackages}`,
      `跳过: ${skippedPackages}`,
      `总耗时: ${Math.round(detailedReport.totalElapsedTime / 1000)}秒`,
      `处理速率: ${detailedReport.processingRate.toFixed(2)} 包/秒`,
    ];

    // 添加详细明细到日志文件
    if (failedList.length > 0) {
      report.push('', '=== 失败包明细 ===');
      failedList.forEach((item, index) => {
        report.push(`${index + 1}. ${item}`);
      });
    }

    return report.join('\n');
  }

  /**
   * 重置跟踪器状态
   */
  reset(): void {
    this.total = 0;
    this.completed = 0;
    this.failed = 0;
    this.packages.clear();
    this.startTime = new Date();
    this.currentOperation = '';
  }

  /**
   * 获取所有包的处理信息
   */
  getAllPackageInfo(): PackageProcessInfo[] {
    return Array.from(this.packages.values());
  }

  /**
   * 获取指定状态的包列表
   */
  getPackagesByStatus(status: PackageStatus): PackageProcessInfo[] {
    return Array.from(this.packages.values()).filter((info) => info.status === status);
  }
}

/**
 * 创建通用进度跟踪器实例
 */
export function createProgressTracker(): GeneralProgressTracker {
  return new GeneralProgressTracker();
}
