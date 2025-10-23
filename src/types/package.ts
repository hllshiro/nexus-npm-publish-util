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
