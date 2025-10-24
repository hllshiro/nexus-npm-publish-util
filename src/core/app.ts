/**
 * 应用主逻辑模块
 * 迁移自 main.js 的核心业务逻辑
 */

import type { CliArgs, OptimizedPublishConfig } from '@/types/config';
import { logger } from '@/utils/logger.js';
import { createPackageManager } from '@/services/package-manager.js';

/**
 * 应用主逻辑类
 */
export class App {
  private config: CliArgs;

  constructor(config: CliArgs) {
    // 验证必需的配置项
    this.validateConfig(config);

    // 设置配置，应用默认值
    this.config = this.applyConfigDefaults(config);
  }

  /**
   * 验证配置参数
   * @param config 配置对象
   */
  private validateConfig(config: CliArgs): void {
    const errors: string[] = [];

    if (!config.publishDir) {
      errors.push('publishDir 是必需的');
    }

    if (!config.publishUrl) {
      errors.push('publishUrl 是必需的');
    }

    if (!config.publishAuth) {
      errors.push('publishAuth 是必需的');
    }

    if (config.threadNumber !== undefined && config.threadNumber <= 0) {
      errors.push('threadNumber 必须大于0');
    }

    if (errors.length > 0) {
      throw new Error(`配置验证失败: ${errors.join(', ')}`);
    }
  }

  /**
   * 应用配置默认值
   * @param config 原始配置
   * @returns 应用默认值后的配置
   */
  private applyConfigDefaults(config: CliArgs): CliArgs {
    return {
      ...config,
      threadNumber: config.threadNumber || 1, // 默认并发数为1
    };
  }

  /**
   * 发布模式
   * 使用新的优化组件进行包发布
   * @param configOverrides 可选的配置覆盖参数
   */
  public async publishMode(configOverrides?: Partial<OptimizedPublishConfig>): Promise<void> {
    logger.info('开始发布');

    try {
      // 创建优化的发布配置，合并默认值和覆盖参数
      const publishConfig: OptimizedPublishConfig = {
        publishDir: this.config.publishDir,
        publishUrl: this.config.publishUrl,
        publishAuth: this.config.publishAuth,
        threadNumber: this.config.threadNumber,
        // 默认的优化配置
        scanPattern: '**/*.tgz',
        requestTimeout: 300000, // 5分钟
        connectTimeout: 30000, // 30秒
        skipExistenceCheck: false,
        enableDetailedLogging: false,
        // 应用配置覆盖
        ...configOverrides,
      };

      // 创建包管理器实例
      const packageManager = createPackageManager(publishConfig);

      // 执行发布流程，传入配置
      const result = await packageManager.publishPackages(publishConfig);

      // 输出结果统计
      if (result.success > 0) {
        logger.info(`成功上传 ${result.success} 个包`);
      }
      if (result.failed.length > 0) {
        logger.error(`失败 ${result.failed.length} 个包:`);
        result.failed.forEach((error) => logger.error(`  - ${error}`));
      }

      if (result.success === 0 && result.failed.length === 0) {
        logger.info('所有包都已存在于远程仓库，无需上传');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('发布流程执行失败', errorMessage);
      throw error;
    }
  }

  /**
   * 运行应用
   */
  public async run(): Promise<void> {
    logger.info(`调用开始: ${new Date().toISOString()}`);
    logger.info(`用户指令: ${process.argv.join(' ')}`);

    try {
      await this.publishMode();
    } catch (err) {
      logger.error('执行失败', err);
      throw err;
    }

    logger.info(`执行结束: ${new Date().toISOString()}`);
  }
}
