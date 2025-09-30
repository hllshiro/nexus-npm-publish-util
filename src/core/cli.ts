/**
 * CLI参数处理模块
 * 迁移自util/argv.js，保持所有命令行参数选项、默认值和验证规则不变
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { CliArgs } from '@/types';

/**
 * 解析命令行参数
 * @returns 解析后的CLI参数
 */
export function parseCliArgs(): CliArgs {
  const argv = yargs(hideBin(process.argv))
    .option('name', {
      alias: 'n',
      description: 'Package name to download',
      type: 'string',
    })
    .option('input', {
      alias: 'i',
      description: 'File with package names',
      type: 'string',
    })
    .option('package', {
      description: 'Path to package.json',
      type: 'string',
    })
    .option('lock', {
      description: 'Parse package-lock.json or pnpm-lock.yaml (highest priority)',
      type: 'string',
    })
    .option('registry', {
      description: 'Override registry URL',
      type: 'string',
    })
    .option('force', {
      description: 'Add --force to npm install',
      type: 'boolean',
      default: false,
    })
    .option('legacy-peer-deps', {
      description: 'Add --legacy-peer-deps to npm install',
      type: 'boolean',
      default: false,
    })
    .option('output', {
      alias: 'o',
      description: 'Download save path',
      type: 'string',
      default: 'download',
    })
    .option('publish', {
      alias: 'p',
      description: 'Enable publish mode (highest priority)',
      type: 'boolean',
      default: false,
    })
    .option('publish-dir', {
      description: 'Directory with packages to publish',
      type: 'string',
      default: 'download',
    })
    .option('publish-url', {
      description: 'Repository publish URL',
      type: 'string',
    })
    .option('publish-auth', {
      description: 'Repository auth (username:password)',
      type: 'string',
    })
    .option('force-publish', {
      description: 'Force publish all packages',
      type: 'boolean',
      default: false,
    })
    .option('thread-number', {
      description: 'Concurrent threads for download/publish',
      type: 'number',
      default: 1,
    })
    .wrap(100) // 为了输出美观，需要调整行宽为适当的值
    .check((argv) => {
      if (argv.name && argv.input) {
        throw new Error('[error] Cannot use --name and --input parameters simultaneously');
      }
      if (argv.force && argv['legacy-peer-deps']) {
        throw new Error('[error] Cannot use --force and --legacy-peer-deps parameters simultaneously');
      }
      if (argv.publish && (!argv['publish-url'] || !argv['publish-auth'])) {
        throw new Error('[error] Must specify --publish-url and --publish-auth parameters in publish mode');
      }
      return true;
    })
    .help()
    .parseSync();

  // 将kebab-case参数转换为camelCase以匹配CliArgs接口
  const result: CliArgs = {
    output: argv.output,
    publishDir: argv['publish-dir'],
    threadNumber: argv['thread-number'],
    force: argv.force,
    legacyPeerDeps: argv['legacy-peer-deps'],
    publish: argv.publish,
    forcePublish: argv['force-publish'],
  };

  // 只添加定义了的可选属性
  if (argv.name !== undefined) result.name = argv.name;
  if (argv.input !== undefined) result.input = argv.input;
  if (argv.package !== undefined) result.package = argv.package;
  if (argv.lock !== undefined) result.lock = argv.lock;
  if (argv.registry !== undefined) result.registry = argv.registry;
  if (argv['publish-url'] !== undefined) result.publishUrl = argv['publish-url'];
  if (argv['publish-auth'] !== undefined) result.publishAuth = argv['publish-auth'];
  if (argv.help !== undefined) result.help = argv.help as boolean;
  if (argv.version !== undefined) result.version = argv.version as boolean;

  return result;
}

/**
 * 验证CLI参数的冲突和必需参数
 * @param args CLI参数
 * @throws Error 当参数验证失败时
 */
export function validateCliArgs(args: CliArgs): void {
  // 检查name和input参数冲突
  if (args.name && args.input) {
    throw new Error('[error] Cannot use --name and --input parameters simultaneously');
  }

  // 检查force和legacy-peer-deps参数冲突
  if (args.force && args.legacyPeerDeps) {
    throw new Error('[error] Cannot use --force and --legacy-peer-deps parameters simultaneously');
  }

  // 检查发布模式必需参数
  if (args.publish && (!args.publishUrl || !args.publishAuth)) {
    throw new Error('[error] Must specify --publish-url and --publish-auth parameters in publish mode');
  }
}

/**
 * 获取默认的CLI参数配置
 * @returns 默认CLI参数
 */
export function getDefaultCliArgs(): Partial<CliArgs> {
  return {
    force: false,
    legacyPeerDeps: false,
    output: 'download',
    publish: false,
    publishDir: 'download',
    forcePublish: false,
    threadNumber: 1,
  };
}
