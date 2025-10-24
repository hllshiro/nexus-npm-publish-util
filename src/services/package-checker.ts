import type { PackageChecker, PackageRegistryResponse } from '../types/package.js';
import type { PackageCheckError } from '../types/error.js';
import { ErrorType } from '../types/error.js';
import { parseRegistryUrl } from '@/utils/registry-url-parser.js';

/**
 * 包检查配置接口
 */
export interface PackageCheckerConfig {
  /** 连接超时时间（毫秒），默认10秒 */
  connectTimeout?: number;
  /** 请求超时时间（毫秒），默认30秒 */
  requestTimeout?: number;
}

/**
 * 基于npm registry的包检查器实现
 * 使用fetch API查询npm registry来检查包是否存在
 */
export class RegistryPackageChecker implements PackageChecker {
  private readonly config: Required<PackageCheckerConfig>;

  constructor(config: PackageCheckerConfig = {}) {
    this.config = {
      connectTimeout: config.connectTimeout ?? 10000,
      requestTimeout: config.requestTimeout ?? 30000,
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
    try {
      // 解析registry URL，构建检查URL
      const { baseUrl, repository } = parseRegistryUrl(registryUrl);
      const encodedName = encodeURIComponent(packageName);

      // 构建检查URL：${BASEURL}/repository/{repository}/${packageName}
      const checkUrl = `${baseUrl}repository/${repository}/${encodedName}`;

      const response = await this.fetchWithTimeout(checkUrl);

      // 404表示包不存在
      if (response.status === 404) {
        return false;
      }

      // 检查其他HTTP错误
      if (!response.ok) {
        throw this.createPackageCheckError(
          ErrorType.REGISTRY_ERROR,
          `HTTP ${response.status}: ${response.statusText}`,
          packageName,
          version,
          registryUrl,
          {
            statusCode: response.status,
            statusText: response.statusText,
          }
        );
      }

      // 解析响应数据
      const packageData = (await response.json()) as PackageRegistryResponse;

      // 检查指定版本是否存在
      return version in packageData.versions;
    } catch (error) {
      if (error instanceof Error) {
        // 处理超时错误
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw this.createPackageCheckError(
            ErrorType.TIMEOUT_ERROR,
            `请求超时: ${error.message}`,
            packageName,
            version,
            registryUrl,
            { originalError: error }
          );
        }

        // 处理网络错误
        if (error.message.includes('fetch') || error.message.includes('network')) {
          throw this.createPackageCheckError(
            ErrorType.NETWORK_ERROR,
            `网络错误: ${error.message}`,
            packageName,
            version,
            registryUrl,
            { originalError: error }
          );
        }

        // 处理JSON解析错误
        if (error.message.includes('JSON') || error.message.includes('parse')) {
          throw this.createPackageCheckError(
            ErrorType.REGISTRY_ERROR,
            `响应解析错误: ${error.message}`,
            packageName,
            version,
            registryUrl,
            { originalError: error }
          );
        }
      }

      // 如果是已知的PackageCheckError，直接抛出
      if (this.isPackageCheckError(error)) {
        throw error;
      }

      // 其他未知错误
      throw this.createPackageCheckError(
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
   * @param url 请求URL
   * @returns Response对象
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'publish-util/1.0.0',
        },
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 创建包检查错误对象
   */
  private createPackageCheckError(
    type: PackageCheckError['type'],
    message: string,
    packageName: string,
    version?: string,
    registryUrl?: string,
    details?: unknown
  ): PackageCheckError {
    const error: PackageCheckError = {
      type,
      message,
      packageName,
      details,
    };

    if (version !== undefined) error.version = version;
    if (registryUrl !== undefined) error.registryUrl = registryUrl;

    return error;
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
