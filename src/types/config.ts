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
 * 优化后的发布配置接口
 */
export interface OptimizedPublishConfig extends PublishConfig {
  /** 文件扫描模式，默认为递归扫描 */
  scanPattern?: string;
  /** HTTP请求超时时间（毫秒） */
  requestTimeout?: number;
  /** 连接超时时间（毫秒） */
  connectTimeout?: number;
  /** 是否跳过包存在性检查，直接上传 */
  skipExistenceCheck?: boolean;
  /** 是否启用详细日志记录 */
  enableDetailedLogging?: boolean;
}

/**
 * CLI参数接口 - 移除forcePublish，因为新设计中每个包都会单独检查
 */
export interface CliArgs extends PublishConfig {
  // 移除 forcePublish?: boolean; - 不再需要
  // 帮助和版本
  help?: boolean;
  version?: boolean;
}

/**
 * 操作结果接口
 */
export interface OperationResult {
  success: number;
  failed: string[];
}
