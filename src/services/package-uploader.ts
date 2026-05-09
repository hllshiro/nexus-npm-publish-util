/**
 * 包上传器实现 - 使用fetch API替代curl命令
 * 支持multipart/form-data文件上传和详细的错误处理
 */

import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  ErrorType,
  PackageStatus,
  type PackageUploadError,
  type PackageUploader,
  type UploadConfig,
  type UploadResult,
} from '@/types/index.ts';
import { buildUploadUrlFromRegistry } from '@/utils/registry-url-parser.ts';
import { ErrorHandler, ErrorClassifier } from '@/utils/error-handler.ts';
import { withRetry } from '@/utils/retry.ts';
import { Buffer } from 'node:buffer';

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

    try {
      const uploadUrl = buildUploadUrlFromRegistry(registryUrl);

      if (this.config.progressTracker) {
        this.config.progressTracker.updateProgress(filePath, PackageStatus.UPLOADING, {
          needsUpload: true,
          statusDetail: `开始上传文件: ${filePath}`,
        });
      }

      const result = await withRetry(() => this.doUpload(filePath, uploadUrl, auth), {
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 30000,
        operationName: `上传包 ${fileName}`,
        retryableCheck: (error) => {
          if (error && typeof error === 'object' && 'type' in error) {
            return ErrorClassifier.isRetryable(error as PackageUploadError);
          }
          return true;
        },
      });

      if (this.config.progressTracker) {
        const status = result.success ? PackageStatus.COMPLETED : PackageStatus.FAILED;
        const updateInfo: { error?: string; statusCode?: number; needsUpload?: boolean; statusDetail?: string } = {
          statusDetail: result.success ? '上传成功' : `上传失败: ${result.error}`,
        };
        if (result.error) updateInfo.error = result.error;
        if (result.statusCode) updateInfo.statusCode = result.statusCode;
        this.config.progressTracker.updateProgress(filePath, status, updateInfo);
      }

      return result;
    } catch (error) {
      const uploadError = this.handleUploadError(error, filePath, registryUrl);

      if (this.config.progressTracker) {
        const failedUpdateInfo: { error?: string; statusCode?: number; needsUpload?: boolean; statusDetail?: string } =
          {
            error: uploadError.message,
            statusDetail: `上传失败: ${uploadError.message}`,
          };
        if (uploadError.statusCode) failedUpdateInfo.statusCode = uploadError.statusCode;
        this.config.progressTracker.updateProgress(filePath, PackageStatus.FAILED, failedUpdateInfo);
      }

      ErrorHandler.logError(uploadError, '包上传');

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
   * 执行单次上传请求
   */
  private async doUpload(filePath: string, uploadUrl: string, auth: string): Promise<UploadResult> {
    const fileName = basename(filePath);
    const fileBuffer = await this.readFileContent(filePath);
    const formData = this.createFormData(fileBuffer, fileName);
    return this.executeUploadRequest(formData, uploadUrl, auth);
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(filePath: string): Promise<Buffer> {
    try {
      await stat(filePath);
      return await readFile(filePath);
    } catch (error) {
      const err = error as ErrnoException;
      if (err.code === 'ENOENT') {
        throw ErrorHandler.createPackageUploadError(ErrorType.FILE_ERROR, `文件不存在: ${filePath}`, 'unknown', filePath);
      } else if (err.code === 'EACCES') {
        throw ErrorHandler.createPackageUploadError(
          ErrorType.FILE_ERROR,
          `文件访问权限不足: ${filePath}`,
          'unknown',
          filePath
        );
      } else {
        throw ErrorHandler.createPackageUploadError(
          ErrorType.FILE_ERROR,
          `文件读取失败: ${err.message}`,
          'unknown',
          filePath,
          undefined,
          undefined,
          undefined,
          { originalError: err }
        );
      }
    }
  }

  /**
   * 创建multipart/form-data表单数据
   */
  private createFormData(fileBuffer: Buffer, fileName: string): FormData {
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(fileBuffer)], {
        type: 'application/x-compressed',
      });
      formData.append('npm.asset', blob, fileName);
      return formData;
    } catch (error) {
      throw ErrorHandler.createPackageUploadError(
        ErrorType.MULTIPART_ERROR,
        `创建表单数据失败: ${(error as Error).message}`,
        'unknown',
        undefined,
        undefined,
        undefined,
        undefined,
        { fileName, originalError: error }
      );
    }
  }

  /**
   * 执行上传请求
   */
  private async executeUploadRequest(formData: FormData, uploadUrl: string, auth: string): Promise<UploadResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.requestTimeout);

    try {
      const authHeader = `Basic ${Buffer.from(auth).toString('base64')}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text();

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          responseBody,
        };
      } else {
        return this.handleHttpError(response.status, response.statusText, responseBody);
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw ErrorHandler.createPackageUploadError(
            ErrorType.TIMEOUT_ERROR,
            `请求超时 (${this.config.requestTimeout}ms)`,
            'unknown',
            undefined,
            uploadUrl,
            undefined,
            undefined,
            { timeout: this.config.requestTimeout }
          );
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
          throw ErrorHandler.createPackageUploadError(
            ErrorType.NETWORK_ERROR,
            `网络请求失败: ${error.message}`,
            'unknown',
            undefined,
            uploadUrl,
            undefined,
            undefined,
            { originalError: error }
          );
        }
      }

      throw ErrorHandler.createPackageUploadError(
        ErrorType.UPLOAD_ERROR,
        `上传请求异常: ${(error as Error).message}`,
        'unknown',
        undefined,
        uploadUrl,
        undefined,
        undefined,
        { originalError: error }
      );
    }
  }

  /**
   * 处理HTTP错误状态码
   */
  private handleHttpError(status: number, statusText: string, responseBody: string): UploadResult {
    let errorMessage = `HTTP ${status}: ${statusText}`;

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
    }

    if (responseBody) {
      try {
        const errorData = JSON.parse(responseBody) as { message?: string; error?: string };
        if (errorData.message) {
          errorMessage += ` - ${errorData.message}`;
        } else if (errorData.error) {
          errorMessage += ` - ${errorData.error}`;
        }
      } catch {
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
      return error as PackageUploadError;
    }

    const err = error as Error;
    return ErrorHandler.createPackageUploadError(
      ErrorType.UPLOAD_ERROR,
      err.message || '未知上传错误',
      'unknown',
      filePath,
      registryUrl,
      undefined,
      undefined,
      { originalError: error }
    );
  }
}

/**
 * 创建默认配置的包上传器实例
 */
export function createPackageUploader(config?: UploadConfig): PackageUploader {
  return new FetchPackageUploader(config);
}
