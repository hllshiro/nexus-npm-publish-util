/**
 * 发布服务 - 优化版本
 *
 * 提供包发布到 Nexus 仓库的功能，使用新的PackageManager进行优化。
 *
 * 主要特性：
 * - 使用fast-glob进行高性能文件扫描
 * - 从.tgz文件内的package.json提取准确的包信息
 * - 单包存在性检查，避免全量仓库扫描
 * - 使用fetch API替代curl命令
 * - 智能并发控制和详细的错误处理
 * - 实时进度跟踪和结构化日志记录
 */

import type { OperationResult, PublishConfig } from '@/types';
import { DefaultPackageManager } from './package-manager';
import { logger } from '@/utils/logger';

/**
 * 封装了优化后的包发布功能，提供简洁的API接口。
 * 内部使用PackageManager协调文件扫描、存在性检查和包上传流程。
 */
export class PublishService {
  private packageManager: DefaultPackageManager | null = null;

  /**
   * 使用优化的包管理器发布包（推荐方法）
   *
   * 执行完整的发布流程：
   * 1. 使用fast-glob扫描.tgz文件
   * 2. 从package.json提取包信息
   * 3. 并发检查包是否已存在
   * 4. 上传不存在或版本不同的包
   *
   * @param config 优化的发布配置
   * @returns 发布结果，包含成功数量和失败列表
   */
  async publishPackagesOptimized(config: PublishConfig): Promise<OperationResult> {
    try {
      // 创建包管理器配置
      const managerConfig: PublishConfig = {
        publishDir: config.publishDir,
        publishRegistry: config.publishRegistry,
        publishAuth: config.publishAuth,
        threadNumber: config.threadNumber,
        enableDetailedLogging: config.enableDetailedLogging ?? false,
        ...(config.scanPattern && { scanPattern: config.scanPattern }),
        ...(config.requestTimeout && { requestTimeout: config.requestTimeout }),
        ...(config.connectTimeout && { connectTimeout: config.connectTimeout }),
      };

      // 创建或重用包管理器实例
      if (!this.packageManager) {
        this.packageManager = new DefaultPackageManager(managerConfig);
      }

      // 执行优化的发布流程
      return await this.packageManager.publishPackages();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('优化发布流程执行失败', { error: errorMessage });

      return {
        success: 0,
        failed: [`优化发布流程执行失败: ${errorMessage}`],
      };
    }
  }

  /**
   * 获取包管理器实例（用于高级操作）
   * @param config 配置
   * @returns 包管理器实例
   */
  getPackageManager(config: PublishConfig): DefaultPackageManager {
    if (!this.packageManager) {
      this.packageManager = new DefaultPackageManager(config);
    }
    return this.packageManager;
  }

  /**
   * 重置包管理器实例
   */
  resetPackageManager(): void {
    this.packageManager = null;
  }
}

/**
 * 创建优化的发布服务实例
 *
 * 工厂函数，用于创建预配置的发布服务实例。
 * 如果提供了配置，会预初始化包管理器以提高性能。
 *
 * @param config 可选的配置选项
 * @returns 发布服务实例
 */
export function createPublishService(config?: Partial<PublishConfig>): PublishService {
  const service = new PublishService();

  if (config) {
    // 预初始化包管理器
    const managerConfig: PublishConfig = {
      publishDir: config.publishDir || '',
      publishRegistry: config.publishRegistry || '',
      publishAuth: config.publishAuth || '',
      threadNumber: config.threadNumber || 3,
      enableDetailedLogging: config.enableDetailedLogging ?? false,
      ...(config.scanPattern && { scanPattern: config.scanPattern }),
      ...(config.requestTimeout && { requestTimeout: config.requestTimeout }),
      ...(config.connectTimeout && { connectTimeout: config.connectTimeout }),
    };

    service.getPackageManager(managerConfig);
  }

  return service;
}

/**
 * 便捷函数：直接使用优化模式发布包
 *
 * 最简单的发布方式，创建临时服务实例并执行发布。
 * 适用于一次性发布操作。
 *
 * @param config 发布配置
 * @returns 发布结果
 */
export async function publishPackagesOptimized(config: PublishConfig): Promise<OperationResult> {
  const service = createPublishService();
  return service.publishPackagesOptimized(config);
}

/**
 * 默认发布服务实例
 */
export const publishService = new PublishService();
