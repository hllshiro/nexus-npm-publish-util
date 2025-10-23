/**
 * 应用主逻辑模块
 * 迁移自 main.js 的核心业务逻辑
 */

import fs from 'fs';

import type { CliArgs } from '@/types/config';
import { logger } from '@/utils/logger.js';
import { getPkgListFromService, publish } from '@/services/publish.js';

/**
 * 应用主逻辑类
 */
export class App {
  private config: CliArgs;

  constructor(config: CliArgs) {
    this.config = config;
  }

  /**
   * 发布模式
   * 注意：此方法将在后续任务中重构为使用新的优化组件
   * 当前临时移除forcePublish逻辑以修复类型错误
   */
  public async publishMode(): Promise<void> {
    logger.info('开始发布');

    // 临时保留旧的全量扫描逻辑，将在后续任务中替换为单包检查
    logger.info('扫描远程仓库(nexus仓库为单线程模型，获取时间与仓库大小有关)');
    let servicePkgList: string[] = [];
    if (this.config.publishUrl) {
      servicePkgList = await getPkgListFromService(this.config.publishUrl);
    }
    logger.info(`扫描结束，共获取到${servicePkgList.length}个包`);

    logger.info('扫描待发布目录');
    const list = fs.readdirSync(this.config.publishDir).filter((item) => servicePkgList.indexOf(item) === -1);

    if (list.length > 0) {
      logger.info(`找到${list.length}个待上传的包`);
      logger.info('开始发布');
      if (this.config.publishUrl && this.config.publishAuth) {
        const res = await publish(
          list,
          this.config.publishDir,
          this.config.publishUrl,
          this.config.publishAuth,
          this.config.threadNumber
        );

        // 回显结果
        if (res.success > 0) {
          logger.info(`成功(${res.success})`);
        }
        if (res.failed.length > 0) {
          logger.error(`失败(${res.failed.length})`, res.failed.join('\n'));
        }
      }
    } else {
      logger.error('未找到待发布的包或全部存在于远端仓库');
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
