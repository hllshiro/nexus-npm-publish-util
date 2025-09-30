/**
 * 文件操作相关类型定义
 */

/**
 * 哈希计算选项
 */
export interface HashOptions {
  method?: string;
  encoding?: 'base64' | 'hex' | 'binary';
}

/**
 * 下载选项
 */
export interface DownloadOptions {
  timeout?: number;
  retries?: number;
}
