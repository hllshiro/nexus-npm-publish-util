import type { PackageChecker } from '../types/package.js';
import type { RetryableOperation } from '../types/error.js';
import { RegistryPackageChecker, type PackageCheckerConfig } from './package-checker.js';
import { RetryableOperationImpl, type RetryConfig } from './retry-operation.js';

/**
 * 并发检查配置接口
 */
export interface ConcurrentCheckerConfig extends PackageCheckerConfig, RetryConfig {
  /** 最大并发数，默认5 */
  maxConcurrency?: number;
}

/**
 * 包检查任务接口
 */
export interface PackageCheckTask {
  packageName: string;
  version: string;
  registryUrl: string;
}

/**
 * 包检查结果接口
 */
export interface PackageCheckResult {
  packageName: string;
  version: string;
  exists: boolean;
  error?: Error;
}

/**
 * 支持并发控制和重试机制的包检查器
 */
export class ConcurrentPackageChecker {
  private readonly checker: PackageChecker;
  private readonly retryOperation: RetryableOperation;
  private readonly maxConcurrency: number;

  constructor(config: ConcurrentCheckerConfig = {}) {
    this.checker = new RegistryPackageChecker(config);
    this.retryOperation = new RetryableOperationImpl(config);
    this.maxConcurrency = config.maxConcurrency ?? 5;
  }

  /**
   * 并发检查多个包的存在性
   * @param tasks 检查任务列表
   * @returns 检查结果列表
   */
  async checkPackagesConcurrently(tasks: PackageCheckTask[]): Promise<PackageCheckResult[]> {
    if (tasks.length === 0) {
      return [];
    }

    // 使用信号量控制并发数
    const semaphore = new Semaphore(this.maxConcurrency);

    // 创建所有检查任务的Promise
    const checkPromises = tasks.map(async (task): Promise<PackageCheckResult> => {
      // 获取信号量许可
      await semaphore.acquire();

      try {
        // 执行带重试的包检查
        const exists = await this.retryOperation.executeWithRetry(() =>
          this.checker.checkPackageExists(task.packageName, task.version, task.registryUrl)
        );

        return {
          packageName: task.packageName,
          version: task.version,
          exists,
        };
      } catch (error) {
        return {
          packageName: task.packageName,
          version: task.version,
          exists: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      } finally {
        // 释放信号量许可
        semaphore.release();
      }
    });

    // 等待所有检查完成
    return await Promise.all(checkPromises);
  }

  /**
   * 检查单个包的存在性（带重试）
   * @param packageName 包名
   * @param version 版本号
   * @param registryUrl 仓库URL
   * @returns 是否存在
   */
  async checkPackageWithRetry(packageName: string, version: string, registryUrl: string): Promise<boolean> {
    return await this.retryOperation.executeWithRetry(() =>
      this.checker.checkPackageExists(packageName, version, registryUrl)
    );
  }

  /**
   * 批量检查包存在性，支持进度回调
   * @param tasks 检查任务列表
   * @param onProgress 进度回调函数
   * @returns 检查结果列表
   */
  async checkPackagesWithProgress(
    tasks: PackageCheckTask[],
    onProgress?: (completed: number, total: number, current: string) => void
  ): Promise<PackageCheckResult[]> {
    if (tasks.length === 0) {
      return [];
    }

    // const results: PackageCheckResult[] = [];
    const semaphore = new Semaphore(this.maxConcurrency);
    let completed = 0;

    // 创建所有检查任务的Promise
    const checkPromises = tasks.map(async (task): Promise<PackageCheckResult> => {
      // 获取信号量许可
      await semaphore.acquire();

      try {
        // 通知开始检查当前包
        onProgress?.(completed, tasks.length, task.packageName);

        // 执行带重试的包检查
        const exists = await this.retryOperation.executeWithRetry(() =>
          this.checker.checkPackageExists(task.packageName, task.version, task.registryUrl)
        );

        const result: PackageCheckResult = {
          packageName: task.packageName,
          version: task.version,
          exists,
        };

        // 更新进度
        completed++;
        onProgress?.(completed, tasks.length, task.packageName);

        return result;
      } catch (error) {
        const result: PackageCheckResult = {
          packageName: task.packageName,
          version: task.version,
          exists: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };

        // 更新进度
        completed++;
        onProgress?.(completed, tasks.length, task.packageName);

        return result;
      } finally {
        // 释放信号量许可
        semaphore.release();
      }
    });

    // 等待所有检查完成
    return await Promise.all(checkPromises);
  }
}

/**
 * 信号量实现，用于控制并发数
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * 获取许可
   */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * 释放许可
   */
  release(): void {
    this.permits++;

    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift();
      if (resolve) {
        this.permits--;
        resolve();
      }
    }
  }

  /**
   * 获取当前可用许可数
   */
  availablePermits(): number {
    return this.permits;
  }

  /**
   * 获取等待队列长度
   */
  getQueueLength(): number {
    return this.waitQueue.length;
  }
}
