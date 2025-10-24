/**
 * 包上传器实现 - 使用fetch API替代curl命令
 * 支持multipart/form-data文件上传和详细的错误处理
 */

import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  ErrorType,
  type PackageUploadError,
  type PackageUploader,
  type UploadConfig,
  type UploadResult,
} from '@/types';
import { fileLogger, logger } from '@/utils/logger.js';
import { buildUploadUrlFromRegistry } from '@/utils/registry-url-parser.js';

// 定义错误接口
interface ErrnoException extends Error {
  errno?: number;
  code?: string;
  path?: string;
  syscall?: string;
}

/**
 * 基于fetch API的包上传器实现
 */
export class FetchPackageUploader implements PackageUploader {
  private config: UploadConfig;

  constructor(config: UploadConfig = {}) {
    this.config = {
      requestTimeout: config.requestTimeout ?? 300000, // 5分钟
      connectTimeout: config.connectTimeout ?? 30000, // 30秒
      enableDetailedLogging: config.enableDetailedLogging ?? false,
      ...(config.progressTracker && { progressTracker: config.progressTracker }),
    };
  }

  /**
   * 上传包文件到远程仓库
   * @param filePath 文件路径
   * @param registryUrl Registry URL (格式: ${BASEURL}/repository/{repository}/)
   * @param auth 认证信息 (username:password格式)
   * @returns 上传结果
   */
  async uploadPackage(filePath: string, registryUrl: string, auth: string): Promise<UploadResult> {
    const fileName = basename(filePath);
    const packageName = this.extractPackageNameFromFileName(fileName);

    try {
      // 构建实际的上传URL
      const uploadUrl = buildUploadUrlFromRegistry(registryUrl);

      // 获取文件大小信息
      let fileStats;
      let fileSize = 0;
      try {
        fileStats = await stat(filePath);
        fileSize = fileStats.size;
      } catch (error) {
        const err = error as ErrnoException;
        if (err.code === 'ENOENT') {
          throw this.createUploadError(ErrorType.FILE_ERROR, `文件不存在: ${filePath}`, {
            filePath,
            errorCode: err.code,
          });
        }
        throw error;
      }

      // 更新进度跟踪器 - 开始上传
      if (this.config.progressTracker) {
        // 注意：如果使用 UploadProgressTracker，可以通过其 setPackageFileSize 方法设置文件大小
        // 这里为了类型安全，我们跳过这个可选功能
        this.config.progressTracker.updateProgress(packageName, 'uploading', {
          needsUpload: true,
          statusDetail: `开始上传文件: ${filePath}`,
        });
      }

      // 记录上传开始信息（隐藏敏感信息）
      const logInfo = {
        fileName,
        packageName,
        fileSize: this.formatFileSize(fileSize),
        registryUrl,
        uploadUrl,
        authFormat: auth.includes(':') ? 'username:password' : '格式错误',
        timeout: this.config.requestTimeout,
      };

      if (this.config.enableDetailedLogging) {
        logger.info(`开始上传包: ${JSON.stringify(logInfo)}`);
      }

      // 读取文件内容
      const fileBuffer = await this.readFileContent(filePath);

      // 创建multipart/form-data
      const formData = await this.createFormData(fileBuffer, fileName);

      // 执行上传请求
      const result = await this.executeUploadRequest(formData, uploadUrl, auth);

      // 更新进度跟踪器 - 上传完成
      if (this.config.progressTracker) {
        const status = result.success ? 'completed' : 'failed';
        const updateInfo: { error?: string; statusCode?: number; needsUpload?: boolean; statusDetail?: string } = {
          statusDetail: result.success ? '上传成功' : `上传失败: ${result.error}`,
        };
        if (result.error) updateInfo.error = result.error;
        if (result.statusCode) updateInfo.statusCode = result.statusCode;

        this.config.progressTracker.updateProgress(packageName, status, updateInfo);
      }

      // 记录上传结果
      if (this.config.enableDetailedLogging) {
        const resultLog = {
          fileName,
          packageName,
          success: result.success,
          statusCode: result.statusCode,
          responseLength: result.responseBody?.length || 0,
          fileSize: this.formatFileSize(fileSize),
        };
        logger.info(`上传完成: ${JSON.stringify(resultLog)}`);
      }

      return result;
    } catch (error) {
      const uploadError = this.handleUploadError(error, filePath, registryUrl);

      // 更新进度跟踪器 - 上传失败
      if (this.config.progressTracker) {
        const failedUpdateInfo: { error?: string; statusCode?: number; needsUpload?: boolean; statusDetail?: string } =
          {
            error: uploadError.message,
            statusDetail: `上传失败: ${uploadError.message}`,
          };
        if (uploadError.statusCode) failedUpdateInfo.statusCode = uploadError.statusCode;

        this.config.progressTracker.updateProgress(packageName, 'failed', failedUpdateInfo);
      }

      // 记录错误信息
      fileLogger.error(`包上传失败: ${fileName}`, {
        error: uploadError.message,
        type: uploadError.type,
        filePath,
        registryUrl,
        details: uploadError.details,
      });

      const result: UploadResult = {
        success: false,
        error: uploadError.message,
      };
      if (uploadError.statusCode !== undefined) result.statusCode = uploadError.statusCode;
      if (uploadError.responseBody !== undefined) result.responseBody = uploadError.responseBody;
      return result;
    }
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(filePath: string): Promise<Buffer> {
    try {
      // 先检查文件是否存在
      await stat(filePath);
      return await readFile(filePath);
    } catch (error) {
      const err = error as ErrnoException;
      if (err.code === 'ENOENT') {
        throw this.createUploadError(ErrorType.FILE_ERROR, `文件不存在: ${filePath}`, {
          filePath,
          errorCode: err.code,
        });
      } else if (err.code === 'EACCES') {
        throw this.createUploadError(ErrorType.FILE_ERROR, `文件访问权限不足: ${filePath}`, {
          filePath,
          errorCode: err.code,
        });
      } else {
        throw this.createUploadError(ErrorType.FILE_ERROR, `文件读取失败: ${err.message}`, {
          filePath,
          originalError: err,
        });
      }
    }
  }

  /**
   * 创建multipart/form-data表单数据
   */
  private async createFormData(fileBuffer: Buffer, fileName: string): Promise<FormData> {
    try {
      const formData = new FormData();

      // 创建Blob对象，指定正确的MIME类型
      const blob = new Blob([fileBuffer], {
        type: 'application/x-compressed',
      });

      // 添加文件到表单数据，使用npm.asset作为字段名（符合Nexus要求）
      formData.append('npm.asset', blob, fileName);

      return formData;
    } catch (error) {
      throw this.createUploadError(ErrorType.MULTIPART_ERROR, `创建表单数据失败: ${(error as Error).message}`, {
        fileName,
        originalError: error,
      });
    }
  }

  /**
   * 执行上传请求
   */
  private async executeUploadRequest(formData: FormData, uploadUrl: string, auth: string): Promise<UploadResult> {
    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.requestTimeout);

    try {
      // 编码认证信息
      const authHeader = `Basic ${Buffer.from(auth).toString('base64')}`;

      // 执行fetch请求
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        body: formData,
        signal: controller.signal,
      });

      // 清除超时定时器
      clearTimeout(timeoutId);

      // 读取响应内容
      const responseBody = await response.text();

      // 记录详细的响应信息（用于调试）
      if (this.config.enableDetailedLogging) {
        const responseLog = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          bodyLength: responseBody.length,
          bodyPreview: responseBody.substring(0, 200), // 只记录前200个字符
        };
        fileLogger.debug(`HTTP响应详情: ${JSON.stringify(responseLog, null, 2)}`);
      }

      // 检查响应状态
      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          responseBody,
        };
      } else {
        // HTTP错误状态码处理
        return this.handleHttpError(response.status, response.statusText, responseBody);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw this.createUploadError(ErrorType.TIMEOUT_ERROR, `请求超时 (${this.config.requestTimeout}ms)`, {
            uploadUrl,
            timeout: this.config.requestTimeout,
          });
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          throw this.createUploadError(ErrorType.NETWORK_ERROR, `网络请求失败: ${error.message}`, {
            uploadUrl,
            originalError: error,
          });
        }
      }

      throw this.createUploadError(ErrorType.UPLOAD_ERROR, `上传请求异常: ${(error as Error).message}`, {
        uploadUrl,
        originalError: error,
      });
    }
  }

  /**
   * 处理HTTP错误状态码
   */
  private handleHttpError(status: number, statusText: string, responseBody: string): UploadResult {
    let errorMessage = `HTTP ${status}: ${statusText}`;

    // 根据状态码分类错误类型
    switch (status) {
      case 400:
        errorMessage = `请求格式错误 (${status}): 可能是文件格式不正确或请求参数有误`;
        break;
      case 401:
        errorMessage = `认证失败 (${status}): 用户名或密码错误`;
        break;
      case 403:
        errorMessage = `权限不足 (${status}): 没有上传权限`;
        break;
      case 404:
        errorMessage = `上传地址不存在 (${status}): 请检查仓库URL是否正确`;
        break;
      case 409:
        errorMessage = `包版本冲突 (${status}): 该版本已存在`;
        break;
      case 413:
        errorMessage = `文件过大 (${status}): 超出服务器限制`;
        break;
      case 429:
        errorMessage = `请求过于频繁 (${status}): 请稍后重试`;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorMessage = `服务器错误 (${status}): ${statusText}`;
        break;
      default:
        // 默认错误消息已设置
        break;
    }

    // 尝试从响应体中提取更详细的错误信息
    if (responseBody) {
      try {
        const errorData = JSON.parse(responseBody) as { message?: string; error?: string };
        if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        } else if (errorData.error) {
          errorMessage += ` - ${errorData.error}`;
        }
      } catch {
        // 如果不是JSON格式，检查是否是HTML错误页面
        if (responseBody.includes('<html>')) {
          errorMessage += ' - 服务器返回HTML错误页面，可能是错误的仓库地址';
        } else if (responseBody.length < 200) {
          errorMessage += ` - ${responseBody.trim()}`;
        }
      }
    }

    return {
      success: false,
      error: errorMessage,
      statusCode: status,
      responseBody,
    };
  }

  /**
   * 处理上传过程中的错误
   */
  private handleUploadError(error: unknown, filePath?: string, registryUrl?: string): PackageUploadError {
    if (error && typeof error === 'object' && 'type' in error) {
      // 如果已经是PackageUploadError，直接返回
      return error as PackageUploadError;
    }

    const err = error as Error;
    return this.createUploadError(ErrorType.UPLOAD_ERROR, err.message || '未知上传错误', {
      filePath,
      registryUrl,
      originalError: error,
    });
  }

  /**
   * 创建上传错误对象
   */
  private createUploadError(
    type: PackageUploadError['type'],
    message: string,
    details: Record<string, unknown>
  ): PackageUploadError {
    return {
      type,
      message,
      details,
      // retryable: false, // 不使用重试机制 - 移除此属性，因为接口中不存在
      packageName: (details.fileName as string) || 'unknown',
      filePath: details.filePath as string,
      uploadUrl: details.registryUrl as string,
      statusCode: details.statusCode as number,
      responseBody: details.responseBody as string,
    };
  }

  /**
   * 从文件名提取包名
   * 支持标准npm包文件名格式：name-version.tgz 或 @scope/name-version.tgz
   */
  private extractPackageNameFromFileName(fileName: string): string {
    // 移除.tgz扩展名
    const nameWithoutExt = fileName.replace(/\.tgz$/, '');

    // 处理scoped包：@scope-name-version -> @scope/name
    if (nameWithoutExt.startsWith('@')) {
      const parts = nameWithoutExt.split('-');
      if (parts.length >= 3) {
        // @scope-name-version -> @scope/name
        const scope = parts[0]; // @scope
        const name = parts[1]; // name
        return `${scope}/${name}`;
      }
    }

    // 处理普通包：name-version -> name
    const lastDashIndex = nameWithoutExt.lastIndexOf('-');
    if (lastDashIndex > 0) {
      return nameWithoutExt.substring(0, lastDashIndex);
    }

    // 如果无法解析，返回原文件名（不含扩展名）
    return nameWithoutExt;
  }

  /**
   * 格式化文件大小为可读字符串
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

/**
 * 创建默认配置的包上传器实例
 */
export function createPackageUploader(config?: UploadConfig): PackageUploader {
  return new FetchPackageUploader(config);
}

/**
 * 默认包上传器实例
 */
export const packageUploader = new FetchPackageUploader({
  enableDetailedLogging: false,
});
