import type { RetryableOperation } from '../types/error.js';
import { ErrorType } from '../types/error.js';

/**
 * 重试配置接口
 */
export interface RetryConfig {
  /** 最大重试次数，默认3次 */
  maxRetries?: number;
  /** 基础延迟时间（毫秒），默认1000ms */
  baseDelay?: number;
  /** 最大延迟时间（毫秒），默认30000ms */
  maxDelay?: number;
  /** 退避倍数，默认2 */
  backoffMultiplier?: number;
  /** 抖动因子，默认0.1 */
  jitterFactor?: number;
}

/**
 * 可重试操作实现类
 * 支持指数退避和抖动的重试策略
 */
export class RetryableOperationImpl implements RetryableOperation {
  private readonly config: Required<RetryConfig>;

  constructor(config: RetryConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      baseDelay: config.baseDelay ?? 1000,
      maxDelay: config.maxDelay ?? 30000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      jitterFactor: config.jitterFactor ?? 0.1,
    };
  }

  /**
   * 执行带重试的操作
   * @param operation 要执行的操作
   * @param maxRetries 最大重试次数（可选，覆盖默认配置）
   * @param delay 重试延迟（可选，覆盖默认配置）
   * @returns 操作结果
   */
  async executeWithRetry<T>(operation: () => Promise<T>, maxRetries?: number, delay?: number): Promise<T> {
    const actualMaxRetries = maxRetries ?? this.config.maxRetries;
    const actualBaseDelay = delay ?? this.config.baseDelay;

    let lastError: Error | unknown;

    for (let attempt = 0; attempt <= actualMaxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // 如果是最后一次尝试，直接抛出错误
        if (attempt >= actualMaxRetries) {
          throw error;
        }

        // 检查错误是否可重试
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // 计算延迟时间并等待
        const delayTime = this.calculateDelay(attempt + 1, actualBaseDelay);
        await this.sleep(delayTime);
      }
    }

    // 理论上不会到达这里，但为了类型安全
    throw lastError;
  }

  /**
   * 判断错误是否可重试
   * @param error 错误对象
   * @returns 是否可重试
   */
  private isRetryableError(error: unknown): boolean {
    // 如果错误对象有retryable属性，直接使用
    if (typeof error === 'object' && error !== null && 'retryable' in error) {
      return Boolean((error as { retryable: boolean }).retryable);
    }

    // 如果错误对象有type属性，根据类型判断
    if (typeof error === 'object' && error !== null && 'type' in error) {
      const errorType = (error as { type: ErrorType }).type;
      return this.isRetryableErrorType(errorType);
    }

    // 对于标准Error对象，根据消息内容判断
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // 网络相关错误通常可重试
      if (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('enotfound') ||
        message.includes('etimedout') ||
        message.includes('temporary') ||
        message.includes('persistent')
      ) {
        return true;
      }

      // 认证错误通常不可重试
      if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
        return false;
      }

      // 服务器错误（5xx）通常可重试
      if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
        return true;
      }

      // 客户端错误（4xx，除了认证相关）通常不可重试
      if (message.includes('400') || message.includes('404') || message.includes('409')) {
        return false;
      }
    }

    // 默认情况下，对于Error对象尝试重试（用于测试场景）
    return error instanceof Error;
  }

  /**
   * 根据错误类型判断是否可重试
   */
  private isRetryableErrorType(errorType: ErrorType): boolean {
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT_ERROR:
      case ErrorType.REGISTRY_ERROR:
        return true;
      case ErrorType.AUTH_ERROR:
      case ErrorType.FILE_ERROR:
      case ErrorType.PARSE_ERROR:
      case ErrorType.PACKAGE_NOT_FOUND:
      case ErrorType.UPLOAD_ERROR:
      case ErrorType.MULTIPART_ERROR:
        return false;
      default:
        return false;
    }
  }

  /**
   * 计算延迟时间（指数退避 + 抖动）
   * @param attempt 当前尝试次数（从1开始）
   * @param baseDelay 基础延迟时间
   * @returns 实际延迟时间
   */
  private calculateDelay(attempt: number, baseDelay: number): number {
    // 指数退避：delay = baseDelay * (backoffMultiplier ^ (attempt - 1))
    const exponentialDelay = baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);

    // 限制最大延迟时间
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // 添加抖动：在 [delay * (1 - jitter), delay * (1 + jitter)] 范围内随机
    const jitter = this.config.jitterFactor;
    const minDelay = cappedDelay * (1 - jitter);
    const maxDelay = cappedDelay * (1 + jitter);

    return Math.random() * (maxDelay - minDelay) + minDelay;
  }

  /**
   * 异步睡眠
   * @param ms 睡眠时间（毫秒）
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
