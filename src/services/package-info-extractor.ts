import * as tar from 'tar';
// 移除未使用的导入
import path from 'path';
import type { PackageInfoExtractor, PackageInfo, TarPackageJson } from '@/types';

/**
 * 基于tar库的包信息提取器实现
 * 从.tgz文件中提取package.json信息
 */
export class TarPackageInfoExtractor implements PackageInfoExtractor {
  /**
   * 从.tgz文件中提取包信息
   * @param tgzFilePath .tgz文件路径
   * @returns 解析结果
   */
  async extractPackageInfo(tgzFilePath: string): Promise<PackageInfo | null> {
    try {
      // 验证文件是否存在
      if (!(await this.fileExists(tgzFilePath))) {
        throw new Error(`文件不存在: ${tgzFilePath}`);
      }

      // 验证文件扩展名
      if (!tgzFilePath.toLowerCase().endsWith('.tgz')) {
        throw new Error(`不是有效的.tgz文件: ${tgzFilePath}`);
      }

      const packageJsonContent = await this.extractPackageJsonFromTar(tgzFilePath);

      if (!packageJsonContent) {
        throw new Error('未找到package.json文件');
      }

      const packageJson = JSON.parse(packageJsonContent) as TarPackageJson;

      // 验证必需字段
      if (!packageJson.name || !packageJson.version) {
        throw new Error('package.json缺少必需字段: name或version');
      }

      const result: PackageInfo = {
        filePath: tgzFilePath,
        fileName: path.basename(tgzFilePath),
        packageName: packageJson.name,
        version: packageJson.version,
      };

      if (packageJson.description) {
        result.description = packageJson.description;
      }

      return result;
    } catch (error) {
      console.error(`解析包信息失败: ${tgzFilePath}`, error);
      return null;
    }
  }

  /**
   * 获取tar文件中所有package.json文件的路径
   * @param tgzFilePath .tgz文件路径
   * @returns package.json文件路径列表
   */
  private async getPackageJsonPaths(tgzFilePath: string): Promise<string[]> {
    const filenames: string[] = [];

    await tar.list({
      file: tgzFilePath,
      onentry: (entry) => {
        if (entry.path.includes('package.json')) {
          filenames.push(entry.path);
        }
      },
    });

    return filenames;
  }

  /**
   * 从多个package.json路径中选择最短的（最接近根目录的）
   * @param paths package.json文件路径列表
   * @returns 最短的路径
   */
  private selectShortestPackageJsonPath(paths: string[]): string | null {
    if (paths.length === 0) {
      return null;
    }

    // 按路径长度排序，选择最短的
    const sortedPaths = paths.sort((a, b) => {
      // 首先按路径分段数排序（/的数量）
      const aSegments = a.split('/').length;
      const bSegments = b.split('/').length;

      if (aSegments !== bSegments) {
        return aSegments - bSegments;
      }

      // 如果分段数相同，按字符串长度排序
      return a.length - b.length;
    });

    return sortedPaths[0] || null;
  }

  /**
   * 从tar文件中提取package.json内容
   * @param tgzFilePath .tgz文件路径
   * @returns package.json内容字符串
   */
  private async extractPackageJsonFromTar(tgzFilePath: string): Promise<string | null> {
    try {
      // 首先获取所有package.json文件路径
      const packageJsonPaths = await this.getPackageJsonPaths(tgzFilePath);

      // 选择最短的路径（最接近根目录）
      const targetPath = this.selectShortestPackageJsonPath(packageJsonPaths);

      if (!targetPath) {
        return null;
      }

      // 提取选中的package.json文件内容
      return new Promise((resolve, reject) => {
        let packageJsonContent: string | null = null;
        let hasError = false;

        // 设置超时，避免长时间阻塞
        const timeout = setTimeout(() => {
          if (!hasError) {
            hasError = true;
            reject(new Error('解析tar文件超时'));
          }
        }, 30000); // 30秒超时

        try {
          tar
            .list({
              file: tgzFilePath,
              onentry: (entry) => {
                if (hasError) return;

                // 只处理我们选中的package.json文件
                if (entry.path === targetPath) {
                  const chunks: Buffer[] = [];

                  entry.on('data', (chunk: Buffer) => {
                    if (!hasError) {
                      chunks.push(chunk);
                    }
                  });

                  entry.on('end', () => {
                    if (!hasError && chunks.length > 0) {
                      packageJsonContent = Buffer.concat(chunks).toString('utf8');
                    }
                  });

                  entry.on('error', (error: unknown) => {
                    if (!hasError) {
                      hasError = true;
                      clearTimeout(timeout);
                      const errorMessage = error instanceof Error ? error.message : String(error);
                      reject(new Error(`读取package.json失败: ${errorMessage}`));
                    }
                  });
                }
              },
            })
            .then(() => {
              if (!hasError) {
                clearTimeout(timeout);
                resolve(packageJsonContent);
              }
            })
            .catch((error: unknown) => {
              if (!hasError) {
                hasError = true;
                clearTimeout(timeout);
                const errorMessage = error instanceof Error ? error.message : String(error);
                reject(new Error(`解析tar文件失败: ${errorMessage}`));
              }
            });
        } catch (error) {
          if (!hasError) {
            hasError = true;
            clearTimeout(timeout);
            const errorMessage = error instanceof Error ? error.message : String(error);
            reject(new Error(`解析tar文件失败: ${errorMessage}`));
          }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`获取package.json路径失败: ${errorMessage}`);
    }
  }

  /**
   * 批量提取多个包的信息
   * @param tgzFilePaths .tgz文件路径列表
   * @returns 包信息列表
   */
  async extractMultiplePackageInfo(tgzFilePaths: string[]): Promise<PackageInfo[]> {
    const results: PackageInfo[] = [];

    // 使用并发处理提高性能，但限制并发数避免资源耗尽
    const concurrency = 5;
    const chunks = this.chunkArray(tgzFilePaths, concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map((filePath) => this.extractPackageInfo(filePath));
      const chunkResults = await Promise.all(promises);

      // 过滤掉null结果
      results.push(...chunkResults.filter((result): result is PackageInfo => result !== null));
    }

    return results;
  }

  /**
   * 验证包信息的完整性
   * @param packageInfo 包信息
   * @returns 是否有效
   */
  validatePackageInfo(packageInfo: PackageInfo): boolean {
    try {
      // 检查必需字段
      if (!packageInfo.packageName || !packageInfo.version || !packageInfo.filePath) {
        return false;
      }

      // 验证包名格式（支持scoped包）
      const packageNameRegex = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
      if (!packageNameRegex.test(packageInfo.packageName)) {
        return false;
      }

      // 验证版本号格式（基本的semver检查）
      const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?(\+[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?$/;
      if (!versionRegex.test(packageInfo.version)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查文件是否存在
   * @param filePath 文件路径
   * @returns 是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 将数组分块
   * @param array 原数组
   * @param size 块大小
   * @returns 分块后的数组
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
