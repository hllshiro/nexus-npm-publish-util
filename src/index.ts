/**
 * 应用入口点
 * 迁移自 main.js 的 main 函数逻辑
 */

import { parseCliArgs, validateCliArgs } from '@/core/cli.js';
import { App } from '@/core/app.js';
import { logger } from '@/utils/logger.js';
import { LpmError } from '@/utils/errors.js';

/**
 * 全局错误处理函数
 * @param error 错误对象
 */
function handleGlobalError(error: unknown): void {
  if (error instanceof LpmError) {
    logger.error(`[${error.code}] ${error.message}`, error.context);
  } else if (error instanceof Error) {
    logger.error('执行失败', error.message);
  } else {
    logger.error('执行失败', String(error));
  }

  // 确保进程以错误状态退出
  process.exit(1);
}

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

/**
 * 主函数
 * 迁移自 main.js 的 main 函数逻辑
 */
async function main(): Promise<void> {
  try {
    // 设置全局错误处理器
    setupGlobalErrorHandlers();

    // 解析CLI参数
    const cliArgs = parseCliArgs();

    // 验证CLI参数
    validateCliArgs(cliArgs);

    // 创建应用实例并运行
    const app = new App(cliArgs);
    await app.run();
  } catch (error) {
    handleGlobalError(error);
  }
}

/**
 * 应用入口点
 * 保持与原 main.js 相同的启动方式
 */
main()
  .then(() => {
    // 主函数正常完成，不需要额外处理
    // 日志记录已在 App.run() 中完成
  })
  .catch((error) => {
    // 这里捕获 main() 函数中未被处理的错误
    handleGlobalError(error);
  });
