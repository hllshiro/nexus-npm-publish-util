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
} from '@/types';
import { logger } from '@/utils/logger.js';

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
  private enableDetailedLogging: boolean;

  constructor(enableDetailedLogging: boolean = false) {
    this.enableDetailedLogging = enableDetailedLogging;
  }

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

    // 初始化所有包的状态
    for (const packageInfo of packages) {
      this.packages.set(packageInfo.packageName, {
        packageInfo,
        status: PackageStatus.PENDING,
        phaseTimings: {},
      });
    }

    logger.info(`初始化进度跟踪器: ${this.total} 个包`);

    if (this.enableDetailedLogging) {
      logger.info('进度跟踪器初始化完成', {
        totalPackages: this.total,
        packages: packages.map((p) => ({ name: p.packageName, version: p.version })),
      });
    }
  }

  /**
   * 更新包的进度状态
   * @param packageName 包名
   * @param status 状态
   * @param additionalInfo 额外信息
   */
  updateProgress(
    packageName: string,
    status: 'scanning' | 'checking' | 'uploading' | 'completed' | 'failed',
    additionalInfo?: {
      error?: string;
      statusCode?: number;
      needsUpload?: boolean;
      statusDetail?: string;
    }
  ): void {
    const packageStatus = this.mapToPackageStatus(status);
    const packageInfo = this.packages.get(packageName);

    if (!packageInfo) {
      logger.warn(`尝试更新未知包的进度: ${packageName}`);
      return;
    }

    const now = new Date();
    const updatedInfo: PackageProcessInfo = {
      ...packageInfo,
      status: packageStatus,
      statusDetail: additionalInfo?.statusDetail || status,
      error: additionalInfo?.error || undefined,
      statusCode: additionalInfo?.statusCode || undefined,
      needsUpload: additionalInfo?.needsUpload || undefined,
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

    this.packages.set(packageName, updatedInfo);

    // 更新计数器
    this.updateCounters();

    // 更新当前操作描述
    this.currentOperation = this.generateCurrentOperationDescription(packageName, status);

    // 记录详细日志
    if (this.enableDetailedLogging) {
      this.logProgressUpdate(packageName, status, additionalInfo);
    }
  }

  /**
   * 映射状态到包状态枚举
   */
  private mapToPackageStatus(status: string): PackageStatus {
    switch (status) {
      case 'scanning':
        return PackageStatus.SCANNING;
      case 'checking':
        return PackageStatus.CHECKING;
      case 'uploading':
        return PackageStatus.UPLOADING;
      case 'completed':
        return PackageStatus.COMPLETED;
      case 'failed':
        return PackageStatus.FAILED;
      default:
        return PackageStatus.PENDING;
    }
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
      if (packageInfo.status === PackageStatus.COMPLETED) {
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
    };

    const statusText = statusMap[status as keyof typeof statusMap] || status;
    return `${statusText} ${packageName}`;
  }

  /**
   * 记录进度更新日志
   */
  private logProgressUpdate(packageName: string, status: string, additionalInfo?: Record<string, unknown>): void {
    logger.info(`包处理进度更新: ${packageName} -> ${status}`, {
      status,
      timestamp: new Date().toISOString(),
      ...additionalInfo,
    });
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

        if (packageInfo.status === PackageStatus.COMPLETED) {
          successful++;
        } else if (packageInfo.status === PackageStatus.FAILED) {
          failed++;
        } else if (packageInfo.status === PackageStatus.SKIPPED) {
          skipped++;
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
        return [PackageStatus.COMPLETED, PackageStatus.FAILED].includes(packageInfo.status);
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
    const successRate =
      detailedReport.totalPackages > 0
        ? ((detailedReport.uploadedPackages / detailedReport.totalPackages) * 100).toFixed(2)
        : '0.00';

    const report = [
      '=== 发布完成报告 ===',
      `总包数: ${detailedReport.totalPackages}`,
      `成功上传: ${detailedReport.uploadedPackages}`,
      `失败: ${detailedReport.failedPackages}`,
      `成功率: ${successRate}%`,
      `总耗时: ${Math.round(detailedReport.totalElapsedTime / 1000)}秒`,
      `处理速率: ${detailedReport.processingRate.toFixed(2)} 包/秒`,
      '',
      '=== 各阶段统计 ===',
    ];

    for (const phase of detailedReport.phaseStatistics) {
      report.push(
        `${phase.phase}: 处理${phase.processed}个, 成功${phase.successful}个, 失败${phase.failed}个, 平均耗时${phase.averageTime}ms`
      );
    }

    if (detailedReport.errors.length > 0) {
      report.push('', '=== 失败详情 ===');
      detailedReport.errors.forEach((error, index) => {
        report.push(`${index + 1}. [${error.phase}] ${error.packageName}: ${error.error}`);
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
export function createProgressTracker(enableDetailedLogging: boolean = false): GeneralProgressTracker {
  return new GeneralProgressTracker(enableDetailedLogging);
}
