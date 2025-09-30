/**
 * 包相关类型定义
 */

/**
 * 包信息接口
 */
export interface PackageInfo {
  name: string;
  version: string;
  resolved: string;
  integrity: string;
  file: string;
}

/**
 * 下载结果接口
 */
export interface DownloadResult {
  success: number;
  failed: PackageInfo[];
}

/**
 * 发布结果接口
 */
export interface PublishResult {
  success: number;
  failed: string[];
}

/**
 * 服务端包项目信息
 */
export interface ServicePackageItem {
  group?: string;
  name: string;
  version: string;
}

/**
 * 服务端包列表响应
 */
export interface ServicePackageListResponse {
  items?: ServicePackageItem[];
  continuationToken?: string;
}

/**
 * 包依赖信息
 */
export interface PackageDependency {
  [packageName: string]: string;
}

/**
 * package.json 基本结构
 */
export interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  scripts?: {
    [scriptName: string]: string;
  };
  dependencies?: PackageDependency;
  devDependencies?: PackageDependency;
  peerDependencies?: PackageDependency;
  optionalDependencies?: PackageDependency;
  [key: string]: any;
}