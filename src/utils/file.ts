/**
 * 文件操作和下载工具模块
 */

import fs from 'fs';
import crypto from 'crypto';
import { ErrorCode } from '@/types/errors.js';

/**
 * 自定义错误类
 */
export class LpmError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: unknown
  ) {
    super(message);
    this.name = 'LpmError';
  }
}

/**
 * 哈希计算选项
 */
export interface HashOptions {
  method?: string;
  encoding?: 'base64' | 'hex' | 'binary';
}

/**
 * 下载文件（推荐方式）
 * @param url 文件地址
 * @param filePath 文件路径
 * @returns Promise<void>
 */
export const downloadFile = async function (url: string, filePath: string): Promise<void> {
  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new LpmError(`下载失败: ${res.statusText}`, ErrorCode.DOWNLOAD_FAILED, {
        url,
        filePath,
        status: res.status,
        statusText: res.statusText,
      });
    }

    if (!res.body) {
      throw new LpmError('响应体为空', ErrorCode.DOWNLOAD_FAILED, { url, filePath });
    }

    // 在 Bun 中，使用 arrayBuffer() 获取数据然后写入文件
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.promises.writeFile(filePath, buffer);
  } catch (error) {
    if (error instanceof LpmError) {
      throw error;
    }

    throw new LpmError(
      `下载文件失败: ${error instanceof Error ? error.message : String(error)}`,
      ErrorCode.DOWNLOAD_FAILED,
      { url, filePath, originalError: error }
    );
  }
};

/**
 * 计算文件的hash值
 * @param filePath 文件路径
 * @param options 哈希选项
 * @returns Promise<string> 哈希值
 */
export const calculateHash = async (filePath: string, options: HashOptions = {}): Promise<string> => {
  const { method = 'sha1', encoding = 'base64' } = options;

  return new Promise<string>((resolve, reject) => {
    try {
      const hash = crypto.createHash(method);
      const rs = fs.createReadStream(filePath);

      rs.on('error', (error) => {
        reject(
          new LpmError(`读取文件失败: ${error.message}`, ErrorCode.FILE_READ_ERROR, { filePath, originalError: error })
        );
      });

      rs.on('data', (chunk: string | Buffer) => {
        hash.update(chunk);
      });

      rs.on('end', () => {
        try {
          const result = hash.digest(encoding);
          resolve(result);
        } catch (error) {
          reject(
            new LpmError(
              `计算哈希值失败: ${error instanceof Error ? error.message : String(error)}`,
              ErrorCode.DOWNLOAD_INTEGRITY_ERROR,
              { filePath, method, encoding, originalError: error }
            )
          );
        }
      });
    } catch (error) {
      reject(
        new LpmError(
          `创建哈希计算器失败: ${error instanceof Error ? error.message : String(error)}`,
          ErrorCode.DOWNLOAD_INTEGRITY_ERROR,
          { filePath, method, encoding, originalError: error }
        )
      );
    }
  });
};

/**
 * 检查文件是否存在
 * @param filePath 文件路径
 * @returns Promise<boolean>
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * 确保目录存在，如果不存在则创建
 * @param dirPath 目录路径
 * @returns Promise<void>
 */
export const ensureDir = async (dirPath: string): Promise<void> => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new LpmError(
      `创建目录失败: ${error instanceof Error ? error.message : String(error)}`,
      ErrorCode.DIRECTORY_CREATE_ERROR,
      { dirPath, originalError: error }
    );
  }
};

/**
 * 获取文件大小
 * @param filePath 文件路径
 * @returns Promise<number> 文件大小（字节）
 */
export const getFileSize = async (filePath: string): Promise<number> => {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.size;
  } catch (error) {
    throw new LpmError(
      `获取文件信息失败: ${error instanceof Error ? error.message : String(error)}`,
      ErrorCode.FILE_READ_ERROR,
      { filePath, originalError: error }
    );
  }
};
