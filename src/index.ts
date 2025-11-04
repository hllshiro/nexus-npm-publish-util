/**
 * 应用入口点
 * 迁移自 main.js 的 main 函数逻辑
 */

import { parseCliArgs } from '@/core/cli';
import { App } from '@/core/app';
import { logger } from '@/utils/logger';

/**
 * 设置全局错误处理器
 */
function setupGlobalErrorHandlers(): void {
  // 处理未捕获的异常
  process.on('uncaughtException', (error: Error) => {
    logger.error('未捕获的异常', error);
    process.exit(1);
  });

  // 处理未处理的Promise拒绝
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('未处理的Promise拒绝', reason);
    process.exit(1);
  });

  // 处理进程退出信号
  process.on('SIGINT', () => {
    logger.info('接收到SIGINT信号，正在退出...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('接收到SIGTERM信号，正在退出...');
    process.exit(0);
  });
}

// 设置全局错误处理器
setupGlobalErrorHandlers();

// 解析CLI参数
const cliArgs = parseCliArgs();

// 创建应用实例并运行
new App(cliArgs).run();
