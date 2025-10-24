/**
 * CLI参数处理模块
 * 迁移自util/argv.js，保持所有命令行参数选项、默认值和验证规则不变
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { CliArgs } from '@/types';
import { parseRegistryUrl } from '@/utils/registry-url-parser.js';

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
    .option('registry', {
      alias: 'r',
      description: 'Repository registry',
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
    .wrap(80)
    .help()
    .parseSync();

  // 验证registry URL格式
  try {
    parseRegistryUrl(argv.registry);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Registry URL格式错误: ${errorMessage}`);
    process.exit(1);
  }

  // 构建CLI参数对象 - 移除forcePublish，因为新设计中每个包都会单独检查
  const result: CliArgs = {
    publishDir: argv.dir,
    threadNumber: argv.threads,
    publishRegistry: argv.registry,
    publishAuth: argv.auth,
  };

  return result;
}
