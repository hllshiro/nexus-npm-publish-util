/**
 * 锁文件解析服务
 * 迁移自 util/lockfile.js, lib/createLock.ts, lib/converter.js
 */

import path from 'path';
import { parse } from 'yaml';
import ProgressBar from 'progress';

import type { NpmLockObject, NpmLockPackage, PnpmLockObject, PackageInfo, DownloadResult } from '@/types/index.js';
import { logger, fileLogger } from '@/utils/logger.js';
import { downloadFile, calculateHash, ensureDir, fileExists } from '@/utils/file.js';
import { asyncFn } from '@/utils/task';

/**
 * 黑名单列表，用于过滤无效的包名
 */
const blackList = ['', '.', '..'];

/**
 * 锁文件解析服务类
 */
export class LockfileService {
  private resolvedPackages: Set<PackageInfo>;

  constructor(content: string, baseURL: string) {
    const lockfileObj = JSON.parse(content) as NpmLockObject;
    this.resolvedPackages = this.resolveLockfile(lockfileObj, baseURL);
  }

  /**
   * 获取解析后的包列表
   */
  public getResolvedPackages(): Set<PackageInfo> {
    return this.resolvedPackages;
  }

  /**
   * 下载所有包
   * @param output 输出目录
   * @param limit 并发限制
   * @returns 下载结果
   */
  public async download(output: string, limit: number): Promise<DownloadResult> {
    // 确保输出目录存在
    await ensureDir(output);

    const result: DownloadResult = {
      success: 0,
      failed: [],
    };

    const bar = new ProgressBar('[progress] [:bar] :percent :pkg', {
      total: this.resolvedPackages.size + 1,
      complete: '=',
      incomplete: ' ',
      width: 40,
    });

    await asyncFn(
      Array.from(this.resolvedPackages),
      async (pkg: PackageInfo) => {
        try {
          const savePath = path.join(output, pkg.file);
          const verify = pkg.integrity.split('-');
          let needDownload = true;

          // 检查文件是否已存在且校验通过
          if (await fileExists(savePath)) {
            const fileHash = await calculateHash(savePath, {
              method: verify[0] || 'sha1',
              encoding: 'base64',
            });
            if (fileHash === verify[1]) {
              result.success++;
              needDownload = false;
            }
          }

          if (needDownload) {
            await downloadFile(pkg.resolved, savePath);
            const fileHash = await calculateHash(savePath, {
              method: verify[0] || 'sha1',
              encoding: 'base64',
            });
            if (fileHash !== verify[1]) {
              throw new Error(`${pkg.name} 校验不匹配`);
            }
            result.success++;
          }
        } catch (err) {
          const msg = `下载错误: ${pkg.name}@${pkg.version} - ${err instanceof Error ? err.message : String(err)}`;
          bar.interrupt(msg);
          fileLogger.error(msg);
          result.failed.push(pkg);
        } finally {
          bar.tick({ pkg: pkg.file });
        }
      },
      limit
    );

    bar.update(1, { pkg: '' });
    logger.info('全部下载完成');
    return result;
  }

  /**
   * 解析锁文件
   * @param lockfileObj 锁文件对象
   * @param baseURL 基础URL
   * @returns 解析后的包集合
   */
  private resolveLockfile(lockfileObj: NpmLockObject, baseURL: string): Set<PackageInfo> {
    switch (lockfileObj.lockfileVersion) {
      case 2:
        return this.resolveV3(Object.assign(lockfileObj.packages, lockfileObj.dependencies), baseURL);
      case 3:
        return this.resolveV3(lockfileObj.packages, baseURL);
      default:
        throw new Error(`unsupported lockfile version: ${lockfileObj.lockfileVersion}`);
    }
  }

  /**
   * 解析V3版本的包信息
   * @param packages 包对象
   * @param baseURL 基础URL
   * @returns 解析后的包集合
   */
  private resolveV3(packages: Record<string, NpmLockPackage>, baseURL: string): Set<PackageInfo> {
    const res = new Set<PackageInfo>();

    for (const [pkg, properties] of Object.entries(packages)) {
      if (!blackList.includes(pkg)) {
        const resolved = this.resolveURL(properties.resolved, baseURL);
        if (!resolved || resolved.length !== 3 || !resolved[1] || !resolved[2]) {
          logger.warn(`包解析错误: ${pkg} ${properties.resolved}`);
          continue;
        }
        res.add({
          name: resolved[1],
          file: resolved[2],
          version: properties.version,
          resolved: properties.resolved,
          integrity: properties.integrity,
        });
      }
    }

    return res;
  }

  /**
   * 解析URL
   * @param url URL字符串
   * @param baseURL 基础URL
   * @returns 解析结果数组
   */
  private resolveURL(url: string | undefined, baseURL: string): RegExpMatchArray | null {
    if (url == null) return null;
    const reg = new RegExp(`${baseURL}(.+)/-/(.+\\.tgz)`);
    return url.match(reg);
  }
}

/**
 * 将 pnpm-lock.yaml 转换为 npm package-lock.json 格式
 * @param pnpmLock pnpm-lock.yaml 内容字符串
 * @returns npm package-lock.json 对象
 */
export function createLock(pnpmLock: string): NpmLockObject {
  const pnpmLockObject = parse(pnpmLock) as PnpmLockObject;

  // 转换 pnpm-lock 对象为 npm package-lock 对象
  const npmLockObject: NpmLockObject = {
    name: 'Lockfile auto-generated with pnpm-lock-to-npm-lock tool',
    version: '1.0.0',
    lockfileVersion: 2,
    requires: true,
    packages: {},
    dependencies: {},
  };

  Object.entries(pnpmLockObject.packages).forEach(([packageName, lockObj]) => {
    let pkgName = packageName.startsWith('/') ? packageName.substring(1) : packageName;

    // 处理带有 peer dependencies 的包名，如 @babel/plugin-syntax-import-attributes@7.24.1(@babel/core@7.25.2)
    // 先移除括号部分（peer dependencies）
    const peerDepMatch = pkgName.match(/^(.+?)(\(.+\))?$/);
    if (peerDepMatch && peerDepMatch[1]) {
      pkgName = peerDepMatch[1]; // 只保留主包名部分
    }

    // 解析版本号：找到最后一个 @ 符号
    const lastAtIndex = pkgName.lastIndexOf('@');
    if (lastAtIndex === -1) {
      return; // 跳过无效的包名
    }

    let version = pkgName.substring(lastAtIndex + 1);
    let actualPkgName = pkgName.substring(0, lastAtIndex);
    let scopedPkgName = actualPkgName;

    // 处理 scoped packages (以 @ 开头的包)
    if (actualPkgName.startsWith('@')) {
      scopedPkgName = actualPkgName;
      const slashIndex = actualPkgName.indexOf('/');
      if (slashIndex !== -1) {
        actualPkgName = actualPkgName.substring(slashIndex + 1);
      }
    }

    const resolved = `https://registry.npmjs.org/${scopedPkgName}/-/${actualPkgName}-${version}.tgz`;

    const dev = lockObj.dev || false;
    const integrity = lockObj.resolution?.integrity || '';
    const baseDepObj: NpmLockPackage = {
      version,
      resolved,
      integrity,
      dev,
    };

    const requires = { [scopedPkgName]: version };
    const dependencies = { [scopedPkgName]: baseDepObj };
    const pkgDepObj: NpmLockPackage = {
      ...baseDepObj,
      requires,
      dependencies,
    };
    npmLockObject.packages[`node_modules/${scopedPkgName}`] = pkgDepObj;
    npmLockObject.dependencies[scopedPkgName] = pkgDepObj;
  });

  return npmLockObject;
}

/**
 * 将 pnpm-lock.yaml 的内容转换为 package-lock.json 的内容
 * @param pnpmLockContent pnpm-lock.yaml 文件的字符串内容
 * @returns 代表 package-lock.json 的 JSON 字符串
 */
export function convertPnpmToNpm(pnpmLockContent: string): string {
  const npmLockObject = createLock(pnpmLockContent);
  return JSON.stringify(npmLockObject, null, 2);
}

/**
 * 解析 package-lock.json 文件
 * @param content 文件内容
 * @param baseUrl 基础URL
 * @returns 锁文件服务实例
 */
export function parsePackageLock(content: string, baseUrl: string): LockfileService {
  return new LockfileService(content, baseUrl);
}

/**
 * 解析 pnpm-lock.yaml 文件并转换为 npm 格式
 * @param pnpmContent pnpm-lock.yaml 内容
 * @param baseUrl 基础URL
 * @returns 锁文件服务实例
 */
export function parsePnpmLock(pnpmContent: string, baseUrl: string): LockfileService {
  const npmContent = convertPnpmToNpm(pnpmContent);
  return new LockfileService(npmContent, baseUrl);
}

// 为了保持与原版本的兼容性，导出原始函数名
export { convertPnpmToNpm as convert };
