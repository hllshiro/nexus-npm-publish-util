/**
 * 应用主逻辑模块
 * 迁移自 main.js 的核心业务逻辑
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline-sync';

import type { CliArgs } from '@/types';
import { logger } from '@/utils/logger.js';
import { nodeVersion, npmRegistry, execInherit } from '@/utils/common.js';
import { LockfileService, convertPnpmToNpm } from '@/services/lockfile.js';
import { getPkgListFromService, publish } from '@/services/publish.js';

// 缓存路径
const _CD = process.cwd();
const _CACHE = path.join(_CD, '.cache');

/**
 * 应用主逻辑类
 */
export class App {
  private config: CliArgs;

  constructor(config: CliArgs) {
    this.config = config;
  }

  /**
   * 创建缓存目录
   */
  public createCache(): void {
    logger.info('创建临时缓存');
    if (fs.existsSync(_CACHE)) {
      fs.rmSync(_CACHE, { recursive: true, force: true });
    }
    fs.mkdirSync(_CACHE);
  }

  /**
   * 清除缓存目录
   */
  public clearCache(): void {
    if (fs.existsSync(_CACHE)) {
      logger.info('清除临时缓存');
      fs.rmSync(_CACHE, { recursive: true, force: true });
    }
  }

  /**
   * 下载模式
   */
  public async downloadMode(): Promise<void> {
    logger.info('下载模式');

    // 环境检查
    let npmRegistryUrl: string;
    try {
      const nodeVer = nodeVersion();
      logger.info(`node version: ${nodeVer}`);
      npmRegistryUrl = this.config.registry ? this.config.registry : npmRegistry();
      logger.info(`npm registry: ${npmRegistryUrl}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(errorMsg);
      process.exit(1);
    }

    // 创建缓存
    this.createCache();

    if (this.config.lock) {
      const lockfilePath = this.config.lock;
      const tempLockPath = path.join(_CACHE, 'package-lock.json');

      if (lockfilePath.endsWith('.yaml') || lockfilePath.endsWith('.yml')) {
        // pnpm-lock.yaml: 在内存中转换为 package-lock.json
        logger.info('检测到 pnpm-lock.yaml，开始在内存中进行转换...');
        try {
          const pnpmLockContent = fs.readFileSync(lockfilePath, 'utf8');
          const npmLockContent = convertPnpmToNpm(pnpmLockContent);
          fs.writeFileSync(tempLockPath, npmLockContent);
          logger.info('转换成功');
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          throw new Error(`pnpm-lock.yaml 转换失败: ${errorMsg}`);
        }
      } else {
        // package-lock.json: 直接复制
        fs.copyFileSync(lockfilePath, tempLockPath);
      }
    } else {
      // 生成lock
      const cmd = 'npm';
      const args = ['install'];

      if (this.config.name) {
        args.push(this.config.name);
      }
      if (this.config.input) {
        const inputContent = fs.readFileSync(this.config.input, 'utf8');
        args.push(inputContent.replace(/[\n\r]/g, ''));
      }
      if (this.config.package) {
        fs.copyFileSync(this.config.package, path.join(_CACHE, 'package.json'));
      }
      if (this.config.force) {
        args.push('--force');
      }
      if (this.config.legacyPeerDeps) {
        args.push('--legacy-peer-deps');
      }

      args.push('--package-lock-only', '--prefix', _CACHE);
      logger.info(`生成lock: ${cmd} ${args.join(' ')}`);
      await execInherit(cmd, args);
      logger.info('生成lock结束');
    }

    // lock解析
    logger.info('解析lock文件');
    const content = fs.readFileSync(path.join(_CACHE, 'package-lock.json'), 'utf8');
    const lockfile = new LockfileService(content, npmRegistryUrl);

    // 下载包
    const resolvedPackages = lockfile.getResolvedPackages();
    logger.info(`共获取到${resolvedPackages.size}个依赖`);
    const res = await lockfile.download(this.config.output, this.config.threadNumber);

    // 回显结果
    if (res.success > 0) {
      logger.info(`成功(${res.success})`);
    }
    if (res.failed.length > 0) {
      const failedMessages = res.failed
        .map((pkg) => {
          if (typeof pkg === 'string') {
            return pkg;
          }
          return `${pkg.name}@${pkg.version}: ${pkg.resolved}`;
        })
        .join('\n');
      logger.error(`失败(${res.failed.length})`, failedMessages);
    }
  }

  /**
   * 发布模式
   */
  public async publishMode(): Promise<void> {
    logger.info('发布模式');

    // 获取服务端缓存
    let servicePkgList: string[] = [];
    if (this.config.forcePublish) {
      logger.info('跳过远程仓库扫描');
    } else {
      logger.info('扫描远程仓库(nexus仓库为单线程模型，获取时间与仓库大小有关)');
      if (this.config.publishUrl) {
        servicePkgList = await getPkgListFromService(this.config.publishUrl);
      }
      logger.info(`扫描结束，共获取到${servicePkgList.length}个包`);
    }

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
   * 处理默认参数
   */
  public defaultParam(): void {
    if (!this.config.name && !this.config.input && !this.config.package && !this.config.lock && !this.config.publish) {
      // 当没有指定任何参数时，同步等待从控制台接受一个输入
      this.config.name = readline.question('Please input package: ');

      // 校验输入是否符合npm包名规范
      if (!/^(@?[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9_-]+$/.test(this.config.name)) {
        logger.error('输入的包名不符合npm包名规范');
        process.exit(1);
      }
    }
  }

  /**
   * 运行应用
   */
  public async run(): Promise<void> {
    logger.info(`调用开始: ${new Date().toISOString()}`);
    logger.info(`用户指令: ${process.argv.join(' ')}`);

    this.defaultParam();

    try {
      if (this.config.publish) {
        await this.publishMode();
      } else {
        await this.downloadMode();
      }
    } catch (err) {
      logger.error('执行失败', err);
      throw err;
    } finally {
      this.clearCache();
    }

    logger.info(`执行结束: ${new Date().toISOString()}`);
  }
}

/**
 * 创建缓存目录的独立函数（保持与原版本兼容）
 */
export const createCache = (): void => {
  logger.info('创建临时缓存');
  if (fs.existsSync(_CACHE)) {
    fs.rmSync(_CACHE, { recursive: true, force: true });
  }
  fs.mkdirSync(_CACHE);
};

/**
 * 清除缓存目录的独立函数（保持与原版本兼容）
 */
export const clearCache = (): void => {
  if (fs.existsSync(_CACHE)) {
    logger.info('清除临时缓存');
    fs.rmSync(_CACHE, { recursive: true, force: true });
    process.exit();
  }
};

/**
 * 下载模式的独立函数（保持与原版本兼容）
 */
export const downloadMode = async (config: CliArgs): Promise<void> => {
  const app = new App(config);
  await app.downloadMode();
};

/**
 * 发布模式的独立函数（保持与原版本兼容）
 */
export const publishMode = async (config: CliArgs): Promise<void> => {
  const app = new App(config);
  await app.publishMode();
};

/**
 * 处理默认参数的独立函数（保持与原版本兼容）
 */
export const defaultParam = (config: CliArgs): void => {
  const app = new App(config);
  app.defaultParam();
};
