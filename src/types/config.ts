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
 * CLI参数接口
 */
export interface CliArgs extends PublishConfig {
  forcePublish?: boolean;
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
