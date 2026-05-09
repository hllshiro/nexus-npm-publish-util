/**
 * CLI参数处理模块
 * 迁移自util/argv.js，保持所有命令行参数选项、默认值和验证规则不变
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { CliArgs } from '@/types/index.ts';
import { LogLevel } from '@/types/index.ts';
import { parseRegistryUrl } from '@/utils/registry-url-parser.ts';
import process from 'node:process';
import denoJson from '../../deno.json' with { type: 'json' };

/**
 * 解析命令行参数
 * @returns 解析后的CLI参数
 */
export async function parseCliArgs(): Promise<CliArgs> {
  const argv = await yargs(hideBin(process.argv))
    .version(denoJson.version)
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
    .option('log-level', {
      alias: 'l',
      description: 'Log level (debug, info, warn, error)',
      type: 'string',
      choices: ['debug', 'info', 'warn', 'error'],
      default: 'info',
    })
    .option('task-file', {
      alias: 'f',
      description: 'Task file path for tracking processed packages (default: ./.publish-task.json)',
      type: 'string',
      default: '.publish-task.json',
    })
    .wrap(80)
    .help()
    .parse();

  // 验证registry URL格式
  try {
    parseRegistryUrl(argv.registry);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Registry URL格式错误: ${errorMessage}`);
    process.exit(1);
  }

  // 验证认证信息格式
  if (!argv.auth || typeof argv.auth !== 'string' || !argv.auth.includes(':')) {
    console.error('❌ 认证信息格式错误，应为 username:password 格式');
    process.exit(1);
  }

  // 解析日志级别
  let logLevel: LogLevel;
  switch (argv['log-level']) {
    case 'debug':
      logLevel = LogLevel.DEBUG;
      break;
    case 'info':
      logLevel = LogLevel.INFO;
      break;
    case 'warn':
      logLevel = LogLevel.WARN;
      break;
    case 'error':
      logLevel = LogLevel.ERROR;
      break;
    default:
      logLevel = LogLevel.INFO;
  }

  // 构建CLI参数对象 - 移除forcePublish，因为新设计中每个包都会单独检查
  const result: CliArgs = {
    publishDir: argv.dir,
    threadNumber: argv.threads,
    publishRegistry: argv.registry,
    publishAuth: argv.auth,
    logLevel,
    taskFilePath: argv['task-file'] as string,
  };

  return result;
}
