/**
 * 配置相关类型定义
 */

/**
 * CLI参数接口
 */
export interface CliArgs {
  // 包相关参数
  name?: string;
  input?: string;
  package?: string;
  lock?: string;
  
  // 注册表和安装选项
  registry?: string;
  force?: boolean;
  legacyPeerDeps?: boolean;
  
  // 输出配置
  output: string;
  
  // 发布模式参数
  publish?: boolean;
  publishDir: string;
  publishUrl?: string;
  publishAuth?: string;
  forcePublish?: boolean;
  
  // 并发配置
  threadNumber: number;
  
  // 帮助和版本
  help?: boolean;
  version?: boolean;
}

/**
 * 应用配置接口
 */
export interface AppConfig {
  // 包相关参数
  name?: string;
  input?: string;
  package?: string;
  lock?: string;
  
  // 注册表和安装选项
  registry?: string;
  force?: boolean;
  legacyPeerDeps?: boolean;
  
  // 输出配置
  output: string;
  
  // 发布模式参数
  publish?: boolean;
  publishDir: string;
  publishUrl?: string;
  publishAuth?: string;
  forcePublish?: boolean;
  
  // 并发配置
  threadNumber: number;
}

/**
 * 发布配置接口
 */
export interface PublishConfig {
  publishDir: string;
  publishUrl: string;
  publishAuth: string;
  threadNumber: number;
}

/**
 * 操作结果接口
 */
export interface OperationResult {
  success: number;
  failed: Array<import('./package.js').PackageInfo | string>;
}