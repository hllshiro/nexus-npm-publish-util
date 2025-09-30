/**
 * 锁文件相关类型定义
 */

/**
 * npm package-lock.json 包信息
 */
export interface NpmLockPackage {
  version: string;
  integrity: string;
  resolved: string;
  requires?: {
    [packageName: string]: string;
  };
  dependencies?: {
    [packageName: string]: NpmLockPackage;
  };
  dev?: boolean;
}

/**
 * npm package-lock.json 根对象
 */
export interface NpmLockObject {
  name: string;
  version: string;
  lockfileVersion: number;
  requires: boolean;
  packages: {
    [packageName: string]: NpmLockPackage;
  };
  dependencies: {
    [packageName: string]: NpmLockPackage;
  };
}

/**
 * pnpm-lock.yaml 包信息
 */
export interface PnpmLockPackage {
  resolution: {
    integrity: string;
  };
  dev?: boolean;
}

/**
 * pnpm-lock.yaml 根对象
 */
export interface PnpmLockObject {
  lockfileVersion: number;
  packages: {
    [packageName: string]: PnpmLockPackage;
  };
}

/**
 * 锁文件转换选项
 */
export interface HandleConversionOpts {
  ctx?: 'RUSH_MONOREPO';
  pnpmPath?: string;
}

/**
 * 文件统计信息
 */
export interface FileStats {
  pnpmStat: import('fs').Stats;
  npmStat: import('fs').Stats;
}

/**
 * 运行时上下文
 */
export const runtimeContext = {
  RUSH: 'RUSH_MONOREPO'
} as const;