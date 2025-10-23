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
    .option('force', {
      alias: 'f',
      description: 'Force publish all packages',
      type: 'boolean',
      default: false,
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

  // 构建CLI参数对象
  const result: CliArgs = {
    publishDir: argv.dir,
    threadNumber: argv.threads,
    forcePublish: argv.force,
    publishUrl: argv.url,
    publishAuth: argv.auth,
  };

  // 只添加定义了的可选属性
  if (argv.help !== undefined) result.help = argv.help as boolean;
  if (argv.version !== undefined) result.version = argv.version as boolean;

  return result;
}
