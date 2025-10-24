/**
 * 应用主逻辑模块
 *
 * 迁移自 main.js 的核心业务逻辑，经过优化以支持新的包管理功能。
 *
 * 主要改进：
 * - 移除了forcePublish参数，改为智能的单包检查
 * - 集成了新的PackageManager进行优化的发布流程
 * - 提供了详细的配置验证和错误处理
 * - 支持灵活的配置覆盖和默认值应用
 */

import type { CliArgs, PublishConfig } from '@/types';
import { logger } from '@/utils/logger.js';
import { createPackageManager } from '@/services/package-manager.js';

/**
 * 应用主逻辑类
 *
 * 负责协调CLI参数处理、配置验证和发布流程执行。
 * 使用优化的PackageManager提供高性能的包发布功能。
 */
export class App {
  private config: CliArgs;

  constructor(config: CliArgs) {
    // 设置配置，应用默认值
    this.config = config;
  }

  /**
   * 发布模式
   *
   * 使用新的优化组件进行包发布，执行完整的发布流程：
   * 1. 创建优化的发布配置
   * 2. 初始化PackageManager
   * 3. 执行扫描→检查→上传流程
   * 4. 输出详细的结果统计
   */
  public async publishMode(): Promise<void> {
    logger.info('开始发布');

    try {
      // 创建优化的发布配置，合并默认值和覆盖参数
      const publishConfig: PublishConfig = {
        publishDir: this.config.publishDir,
        publishRegistry: this.config.publishRegistry,
        publishAuth: this.config.publishAuth,
        threadNumber: this.config.threadNumber,
        // 默认的优化配置
        scanPattern: '**/*.tgz',
        requestTimeout: 300000, // 5分钟
        connectTimeout: 30000, // 30秒
        enableDetailedLogging: false,
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
