import type { OptimizedPublishConfig, OperationResult } from './config.js';

/**
 * 包依赖信息
 */
export interface PackageDependency {
  [packageName: string]: string;
}

/**
 * 包信息接口 - 用于新的文件扫描功能
 */
export interface PackageInfo {
  /** 文件完整路径 */
  filePath: string;
  /** 文件名 */
  fileName: string;
  /** 包名（从package.json解析） */
  packageName: string;
  /** 版本号（从package.json解析） */
  version: string;
  /** 包描述（可选） */
  description?: string;
}

/**
 * 包扫描器接口
 */
export interface PackageScanner {
  /**
   * 扫描指定目录下的所有.tgz文件
   * @param directory 扫描目录
   * @returns 文件路径列表
   */
  scanPackages(directory: string): Promise<string[]>;
}

/**
 * 包信息提取器接口
 */
export interface PackageInfoExtractor {
  /**
   * 从.tgz文件中提取包信息
   * @param tgzFilePath .tgz文件路径
   * @returns 解析结果
   */
  extractPackageInfo(tgzFilePath: string): Promise<PackageInfo | null>;
}

/**
 * 从.tgz文件内部解析的package.json结构
 */
export interface TarPackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * 包检查器接口
 */
export interface PackageChecker {
  /**
   * 检查包是否存在于远程仓库
   * @param packageName 包名
   * @param version 版本号
   * @param registryUrl 仓库URL
   * @returns 是否存在
   */
  checkPackageExists(packageName: string, version: string, registryUrl: string): Promise<boolean>;
}

/**
 * 包注册表响应接口
 */
export interface PackageRegistryResponse {
  name: string;
  versions: Record<string, unknown>;
  'dist-tags': {
    latest: string;
  };
}

/**
 * 包上传器接口
 */
export interface PackageUploader {
  /**
   * 上传包文件到远程仓库
   * @param filePath 文件路径
   * @param uploadUrl 上传URL
   * @param auth 认证信息
   * @returns 上传结果
   */
  uploadPackage(filePath: string, uploadUrl: string, auth: string): Promise<UploadResult>;
}

/**
 * 上传结果接口
 */
export interface UploadResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  responseBody?: string;
}

/**
 * 包管理器接口
 */
export interface PackageManager {
  /**
   * 执行完整的发布流程
   * @param config 发布配置
   * @returns 操作结果
   */
  publishPackages(config: OptimizedPublishConfig): Promise<OperationResult>;
}

/**
 * 发布任务接口
 */
export interface PublishTask {
  packageInfo: PackageInfo;
  needsUpload: boolean;
  uploadResult?: UploadResult;
}
