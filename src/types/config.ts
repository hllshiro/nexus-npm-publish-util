/**
 * 发布配置接口
 */
export interface CliArgs {
  publishDir: string;
  publishRegistry: string;
  publishAuth: string;
  threadNumber: number;
}

/**
 * 优化后的发布配置接口
 */
export interface PublishConfig extends CliArgs {
  /** 文件扫描模式，默认为递归扫描 */
  scanPattern?: string;
  /** HTTP请求超时时间（毫秒） */
  requestTimeout?: number;
  /** 连接超时时间（毫秒） */
  connectTimeout?: number;
  /** 是否启用详细日志记录 */
  enableDetailedLogging?: boolean;
}

/**
 * 操作结果接口
 */
export interface OperationResult {
  success: number;
  failed: string[];
}
