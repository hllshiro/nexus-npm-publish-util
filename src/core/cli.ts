/**
 * CLI参数处理模块
 * 迁移自util/argv.js，保持所有命令行参数选项、默认值和验证规则不变
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { CliArgs } from '@/types/config';

/**
 * 解析命令行参数
 * @returns 解析后的CLI参数
 */
export function parseCliArgs(): CliArgs {
  const argv = yargs(hideBin(process.argv))
    .option('dir', {
      alias: 'd',
      description: 'Directory with packages to publish',
      type: 'string',
      required: true,
    })
    .option('url', {
      alias: 'u',
      description: 'Repository URL',
      type: 'string',
      required: true,
    })
    .option('auth', {
      alias: 'a',
      description: 'Repository auth (username:password)',
      type: 'string',
      required: true,
    })

    .option('threads', {
      alias: 't',
      description: 'Concurrent threads',
      type: 'number',
      default: 1,
    })
    .wrap(100)
    .help()
    .parseSync();

  // 构建CLI参数对象 - 移除forcePublish，因为新设计中每个包都会单独检查
  const result: CliArgs = {
    publishDir: argv.dir,
    threadNumber: argv.threads,
    publishUrl: argv.url,
    publishAuth: argv.auth,
  };

  // 只添加定义了的可选属性
  if (argv.help !== undefined) result.help = argv.help as boolean;
  if (argv.version !== undefined) result.version = argv.version as boolean;

  return result;
}
