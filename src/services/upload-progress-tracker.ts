/**
 * 上传进度跟踪器 - 提供详细的上传状态信息和日志记录
 */

import type { ProgressTracker, ProgressReport } from '@/types/error.js';
import { fileLogger, logger } from '@/utils/logger.js';

/**
 * 包上传状态枚举
 */
export enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * 包上传信息接口
 */
export interface PackageUploadInfo {
  /** 包名 */
  packageName: string;
  /** 文件路径 */
  filePath: string;
  /** 当前状态 */
  status: UploadStatus;
  /** 详细状态（用于进度计算） */
  detailedStatus?: string;
  /** 开始时间 */
  startTime?: Date;
  /** 完成时间 */
  endTime?: Date;
  /** 错误信息 */
  error?: string;
  /** 上传大小（字节） */
  fileSize?: number;
  /** HTTP状态码 */
  statusCode?: number;
}

/**
 * 上传进度跟踪器实现
 */
export class UploadProgressTracker implements ProgressTracker {
  public total: number = 0;
  public completed: number = 0;
  public failed: number = 0;

  private packages: Map<string, PackageUploadInfo> = new Map();
  private startTime: Date = new Date();
  private currentOperation: string = '';
  private enableDetailedLogging: boolean;

  constructor(enableDetailedLogging: boolean = false) {
    this.enableDetailedLogging = enableDetailedLogging;
  }

  /**
   * 初始化跟踪器
   * @param packageNames 要跟踪的包名列表
   */
  initialize(packageNames: string[]): void {
    this.total = packageNames.length;
    this.completed = 0;
    this.failed = 0;
    this.startTime = new Date();
    this.packages.clear();

    // 初始化所有包的状态
    for (const packageName of packageNames) {
      this.packages.set(packageName, {
        packageName,
        filePath: '',
        status: UploadStatus.PENDING,
      });
    }

    logger.info(`初始化上传进度跟踪器: ${this.total} 个包`);
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
    additionalInfo?: Partial<PackageUploadInfo>
  ): void {
    const uploadStatus = this.mapToUploadStatus(status);
    const packageInfo = this.packages.get(packageName);

    if (!packageInfo) {
      // 如果包不存在，创建新的记录
      this.packages.set(packageName, {
        packageName,
        filePath: additionalInfo?.filePath || '',
        status: uploadStatus,
        detailedStatus: status,
        ...(uploadStatus === UploadStatus.UPLOADING && { startTime: new Date() }),
        ...additionalInfo,
      });
      this.total++;
    } else {
      // 更新现有包的信息
      const updatedInfo: PackageUploadInfo = {
        ...packageInfo,
        status: uploadStatus,
        detailedStatus: status,
        ...additionalInfo,
      };

      // 设置时间戳
      if (uploadStatus === UploadStatus.UPLOADING && !updatedInfo.startTime) {
        updatedInfo.startTime = new Date();
      } else if (
        (uploadStatus === UploadStatus.COMPLETED || uploadStatus === UploadStatus.FAILED) &&
        !updatedInfo.endTime
      ) {
        updatedInfo.endTime = new Date();
      }

      this.packages.set(packageName, updatedInfo);
    }

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
   * 映射状态到上传状态枚举
   */
  private mapToUploadStatus(status: string): UploadStatus {
    switch (status) {
      case 'scanning':
        return UploadStatus.PENDING;
      case 'checking':
        return UploadStatus.PENDING;
      case 'uploading':
        return UploadStatus.UPLOADING;
      case 'completed':
        return UploadStatus.COMPLETED;
      case 'failed':
        return UploadStatus.FAILED;
      default:
        return UploadStatus.PENDING;
    }
  }

  /**
   * 更新计数器
   */
  private updateCounters(): void {
    this.completed = 0;
    this.failed = 0;

    for (const packageInfo of this.packages.values()) {
      if (packageInfo.status === UploadStatus.COMPLETED) {
        this.completed++;
      } else if (packageInfo.status === UploadStatus.FAILED) {
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
  private logProgressUpdate(packageName: string, status: string, additionalInfo?: Partial<PackageUploadInfo>): void {
    const logData = {
      packageName,
      status,
      timestamp: new Date().toISOString(),
      ...additionalInfo,
    };

    // 隐藏敏感信息
    if (logData.error) {
      // 不记录包含认证信息的错误详情
      logData.error = logData.error.replace(/Basic\s+[A-Za-z0-9+/=]+/g, 'Basic [HIDDEN]');
    }

    fileLogger.debug(`进度更新: ${JSON.stringify(logData)}`);
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
      // 已扫描：不是初始PENDING状态，或者有详细状态
      if (packageInfo.status !== UploadStatus.PENDING || packageInfo.detailedStatus) {
        scannedPackages++;
      }
      // 已检查：正在上传、已完成或已失败
      if (
        packageInfo.status === UploadStatus.UPLOADING ||
        packageInfo.status === UploadStatus.COMPLETED ||
        packageInfo.status === UploadStatus.FAILED
      ) {
        checkedPackages++;
      }
      // 已上传：状态为完成
      if (packageInfo.status === UploadStatus.COMPLETED) {
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
   * 获取详细的统计信息
   */
  getDetailedStats(): {
    summary: ProgressReport;
    timing: {
      startTime: Date;
      elapsedSeconds: number;
      averageTimePerPackage: number;
      estimatedRemainingSeconds: number;
    };
    packages: PackageUploadInfo[];
    errors: string[];
  } {
    const summary = this.getProgressReport();
    const now = new Date();
    const elapsedMs = now.getTime() - this.startTime.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    // 计算平均处理时间
    const processedCount = this.completed + this.failed;
    const averageTimePerPackage = processedCount > 0 ? elapsedSeconds / processedCount : 0;

    // 估算剩余时间
    const remainingCount = this.total - processedCount;
    const estimatedRemainingSeconds = remainingCount > 0 ? Math.ceil(remainingCount * averageTimePerPackage) : 0;

    // 收集错误信息
    const errors: string[] = [];
    const packages: PackageUploadInfo[] = [];

    for (const packageInfo of this.packages.values()) {
      packages.push({ ...packageInfo });
      if (packageInfo.status === UploadStatus.FAILED && packageInfo.error) {
        errors.push(`${packageInfo.packageName}: ${packageInfo.error}`);
      }
    }

    return {
      summary,
      timing: {
        startTime: this.startTime,
        elapsedSeconds,
        averageTimePerPackage,
        estimatedRemainingSeconds,
      },
      packages,
      errors,
    };
  }

  /**
   * 记录包文件大小信息
   * @param packageName 包名
   * @param fileSize 文件大小（字节）
   */
  setPackageFileSize(packageName: string, fileSize: number): void {
    const packageInfo = this.packages.get(packageName);
    if (packageInfo) {
      packageInfo.fileSize = fileSize;
      this.packages.set(packageName, packageInfo);
    }
  }

  /**
   * 生成最终报告
   */
  generateFinalReport(): string {
    const stats = this.getDetailedStats();
    const { summary, timing, errors } = stats;

    const successRate =
      summary.totalPackages > 0 ? ((summary.uploadedPackages / summary.totalPackages) * 100).toFixed(2) : '0.00';

    const report = [
      '=== 上传完成报告 ===',
      `总包数: ${summary.totalPackages}`,
      `成功上传: ${summary.uploadedPackages}`,
      `失败: ${summary.failedPackages}`,
      `成功率: ${successRate}%`,
      `总耗时: ${timing.elapsedSeconds}秒`,
      `平均每包耗时: ${timing.averageTimePerPackage.toFixed(2)}秒`,
    ];

    if (errors.length > 0) {
      report.push('', '=== 失败详情 ===');
      errors.forEach((error, index) => {
        report.push(`${index + 1}. ${error}`);
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
}

/**
 * 创建上传进度跟踪器实例
 */
export function createUploadProgressTracker(enableDetailedLogging: boolean = false): UploadProgressTracker {
  return new UploadProgressTracker(enableDetailedLogging);
}
