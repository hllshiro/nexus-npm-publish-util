/**
 * 重试工具 - 提供带指数退避的重试机制
 */

import { logger } from './logger.ts';

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大尝试次数（含首次），默认 3 */
  maxAttempts: number;
  /** 基础延迟（毫秒），默认 1000 */
  baseDelay: number;
  /** 最大延迟（毫秒），默认 10000 */
  maxDelay: number;
  /** 判断错误是否可重试，默认所有错误都重试 */
  retryableCheck: (error: unknown) => boolean;
  /** 操作名称，用于日志 */
  operationName: string;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableCheck: () => true,
  operationName: 'operation',
};

/**
 * 计算指数退避延迟（含抖动）
 * @param attempt 当前尝试次数（从 0 开始）
 * @param baseDelay 基础延迟
 * @param maxDelay 最大延迟
 * @returns 延迟毫秒数
 */
export function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelay);
  // 添加 0~25% 的随机抖动，避免雷群效应
  const jitter = capped * (0.75 + Math.random() * 0.25);
  return Math.round(jitter);
}

/**
 * 带重试的异步函数执行器
 *
 * @param fn 要执行的异步函数
 * @param config 重试配置（可选，使用默认值覆盖）
 * @returns 执行结果
 * @throws 最后一次尝试的错误
 */
export async function withRetry<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 最后一次尝试，不再重试
      if (attempt === cfg.maxAttempts - 1) {
        break;
      }

      // 检查是否可重试
      if (!cfg.retryableCheck(error)) {
        logger.debug(`${cfg.operationName}: 错误不可重试，直接抛出`);
        throw error;
      }

      const delay = calculateDelay(attempt, cfg.baseDelay, cfg.maxDelay);
      logger.debug(
        `${cfg.operationName}: 第 ${attempt + 1} 次失败，${delay}ms 后重试 (${attempt + 2}/${cfg.maxAttempts})`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 延迟指定毫秒
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
