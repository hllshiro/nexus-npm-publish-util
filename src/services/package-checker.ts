import {
  ErrorType,
  type PackageChecker,
  type PackageCheckerConfig,
  type PackageCheckError,
  type PackageRegistryResponse,
} from '@/types/index.ts';
import { ensureUrlEndsWithSlash } from '@/utils/registry-url-parser.ts';
import { ErrorHandler, ErrorClassifier } from '@/utils/error-handler.ts';
import { withRetry } from '@/utils/retry.ts';

/**
 * 基于npm registry的包检查器实现
 * 使用fetch API查询npm registry来检查包是否存在
 */
export class RegistryPackageChecker implements PackageChecker {
  private readonly config: Required<PackageCheckerConfig>;

  constructor(config: PackageCheckerConfig = {}) {
    this.config = {
      requestTimeout: config.requestTimeout ?? 30000,
      auth: config.auth ?? '',
    };
  }

  /**
   * 检查包是否存在于远程仓库
   * @param packageName 包名
   * @param version 版本号
   * @param registryUrl 仓库URL (格式: ${BASEURL}/repository/{repository}/)
   * @returns 是否存在
   */
  async checkPackageExists(packageName: string, version: string, registryUrl: string): Promise<boolean> {
    return await withRetry(() => this.doCheckPackageExists(packageName, version, registryUrl), {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      operationName: `检查包 ${packageName}@${version}`,
      retryableCheck: (error) => {
        if (error && typeof error === 'object' && 'type' in error) {
          return ErrorClassifier.isRetryable(error as PackageCheckError);
        }
        return true;
      },
    });
  }

  /**
   * 执行单次包存在性检查
   */
  private async doCheckPackageExists(packageName: string, version: string, registryUrl: string): Promise<boolean> {
    try {
      const encodedName = encodeURIComponent(packageName);
      const checkUrl = `${ensureUrlEndsWithSlash(registryUrl)}${encodedName}`;

      const response = await this.fetchWithTimeout(checkUrl);

      if (response.status === 404) {
        return false;
      }

      if (!response.ok) {
        throw ErrorHandler.createPackageCheckError(
          ErrorType.REGISTRY_ERROR,
          `HTTP ${response.status}: ${response.statusText}`,
          packageName,
          version,
          registryUrl,
          { statusCode: response.status, statusText: response.statusText }
        );
      }

      const packageData = (await response.json()) as PackageRegistryResponse;
      return version in packageData.versions;
    } catch (error) {
      if (this.isPackageCheckError(error)) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw ErrorHandler.createPackageCheckError(
            ErrorType.TIMEOUT_ERROR,
            `请求超时: ${error.message}`,
            packageName,
            version,
            registryUrl,
            { originalError: error }
          );
        }

        if (error.message.includes('fetch') || error.message.includes('network')) {
          throw ErrorHandler.createPackageCheckError(
            ErrorType.NETWORK_ERROR,
            `网络错误: ${error.message}`,
            packageName,
            version,
            registryUrl,
            { originalError: error }
          );
        }
      }

      throw ErrorHandler.createPackageCheckError(
        ErrorType.REGISTRY_ERROR,
        `未知错误: ${error instanceof Error ? error.message : String(error)}`,
        packageName,
        version,
        registryUrl,
        { originalError: error }
      );
    }
  }

  /**
   * 使用超时控制的fetch请求
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'publish-util/1.0.0',
    };

    if (this.config.auth) {
      headers.Authorization = `Basic ${btoa(this.config.auth)}`;
    }

    try {
      return await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 类型守卫：检查是否为PackageCheckError
   */
  private isPackageCheckError(error: unknown): error is PackageCheckError {
    return (
      typeof error === 'object' && error !== null && 'type' in error && 'message' in error && 'packageName' in error
    );
  }
}
