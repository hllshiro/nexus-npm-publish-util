/**
 * 发布服务 - 优化版本
 * 提供包发布到 Nexus 仓库的功能，使用新的PackageManager进行优化
 */

import * as http from 'node:http';
import * as https from 'node:https';
import { exec } from 'node:child_process';
import ProgressBar from 'progress';
import type { ServicePackageItem, ServicePackageListResponse } from '@/types/package.js';
import type { OperationResult, PublishConfig, OptimizedPublishConfig } from '@/types/config.js';
import { fileLogger, logger } from '@/utils/logger';
import { asyncFn } from '@/utils/task';
import { DefaultPackageManager, type PackageManagerConfig } from './package-manager.js';
import { enhancedLogger } from '@/utils/enhanced-logger.js';

/**
 * 递归请求获取包列表
 * @param publishURL 发布地址
 * @param continuationToken 续传token
 * @param list 累积的包列表
 * @returns 完整的包列表
 */
const recursiveReq = async (publishURL: string, continuationToken?: string, list: string[] = []): Promise<string[]> => {
  const token = continuationToken ? '&continuationToken=' + continuationToken : '';
  const request = publishURL.startsWith('https://') ? https : http;

  const data = await new Promise<string>((resolve, reject) => {
    request
      .get(publishURL + token, (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          resolve(raw);
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });

  const json = JSON.parse(data) as ServicePackageListResponse;

  if (json.items) {
    list.push(
      ...json.items.map((item: ServicePackageItem) => {
        const g = item.group ? item.group + '-' : '';
        const n = item.name + '-';
        const v = item.version + '.tgz';
        return g + n + v;
      })
    );
  }

  if (json.continuationToken) {
    await recursiveReq(publishURL, json.continuationToken, list);
  }

  return list;
};

/**
 * 从服务获取包列表
 * @param publishURL 发布地址
 * @returns 包列表
 */
export const getPkgListFromService = async (publishURL: string): Promise<string[]> => {
  const bar = new ProgressBar('[progress] :elapseds', { total: Number.MAX_VALUE });
  const timer = setInterval(() => {
    bar.tick();
  }, 100);

  try {
    return await recursiveReq(publishURL);
  } finally {
    bar.update(1);
    clearInterval(timer);
  }
};

/**
 * 构建curl命令
 * @param auth 认证信息
 * @param url 上传URL
 * @param filename 文件名
 * @returns curl命令字符串
 */
const buildCurlCommand = (auth: string, url: string, filename: string): string => {
  // 确保认证信息格式正确
  if (!auth.includes(':')) {
    throw new Error('认证信息格式错误，应为 username:password');
  }

  // 确保URL格式正确
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('URL格式错误，应以 http:// 或 https:// 开头');
  }

  // 构建curl命令，使用双引号包围参数以处理特殊字符
  return `curl -u "${auth}" -X POST "${url}" -H "Accept: application/json" -H "Content-Type: multipart/form-data" -F "npm.asset=@${filename};type=application/x-compressed" --show-error --max-time 300 --connect-timeout 30`;
};

/**
 * 执行curl命令
 * @param curl curl命令
 * @param options 执行选项
 * @returns 执行结果
 */
const execCurl = async (curl: string, options: { cwd: string }): Promise<void> => {
  return new Promise((resolve, reject) => {
    exec(curl, options, (error, stdout, stderr) => {
      // 记录详细的curl执行信息用于调试
      const debugInfo = {
        command: curl.replace(/-u\s+[^:]+:[^\s]+/, '-u [HIDDEN_AUTH]'), // 隐藏认证信息
        stdout: stdout?.trim() || '',
        stderr: stderr?.trim() || '',
        exitCode: error?.code || 0,
        cwd: options.cwd,
      };

      if (error) {
        // 详细的错误信息
        let errorMsg = `Command failed: ${error.message}`;
        if (error.code) {
          errorMsg += ` (exit code: ${error.code})`;
        }
        if (stderr) {
          errorMsg += `\nstderr: ${stderr}`;
        }
        if (stdout) {
          errorMsg += `\nstdout: ${stdout}`;
        }

        fileLogger.error(`curl执行失败: ${JSON.stringify(debugInfo, null, 2)}`);
        reject(new Error(errorMsg));
      } else {
        // 检查响应内容，确保不是HTML错误页面
        if (stdout && stdout.includes('<html>')) {
          const errorMsg = '服务器返回HTML页面，可能是错误的仓库地址或认证失败';
          fileLogger.error(`curl响应异常: ${JSON.stringify(debugInfo, null, 2)}`);
          reject(new Error(errorMsg));
        } else if (stderr && stderr.trim()) {
          // curl的进度信息通常输出到stderr，需要区分错误和进度信息
          const stderrLower = stderr.toLowerCase();
          if (
            stderr.includes('% Total') ||
            stderr.includes('Dload') ||
            stderr.includes('Upload') ||
            stderr.includes('Speed') ||
            stderr.includes('Time') ||
            stderrLower.includes('connecting to') ||
            stderrLower.includes('connected to')
          ) {
            // 这是curl的进度信息或连接信息，不是错误
            fileLogger.debug(`curl进度信息: ${stderr}`);
            resolve();
          } else if (
            stderrLower.includes('error') ||
            stderrLower.includes('failed') ||
            stderrLower.includes('timeout') ||
            stderrLower.includes('refused') ||
            stderrLower.includes('not found')
          ) {
            // 明确的错误信息
            const errorMsg = `curl错误: ${stderr}`;
            fileLogger.error(`curl stderr错误: ${JSON.stringify(debugInfo, null, 2)}`);
            reject(new Error(errorMsg));
          } else {
            // 其他stderr输出，记录但不作为错误
            fileLogger.warn(`curl stderr输出: ${stderr}`);
            resolve();
          }
        } else {
          fileLogger.debug(`curl执行成功: ${JSON.stringify(debugInfo, null, 2)}`);
          resolve();
        }
      }
    });
  });
};

/**
 * 发布包到仓库
 * @param publishList 发布列表
 * @param cwd 工作目录
 * @param url 发布地址
 * @param auth 认证信息
 * @param limit 并发数
 * @returns 发布结果
 */
export const publish = async (
  publishList: string[],
  cwd: string,
  url: string,
  auth: string,
  limit: number
): Promise<OperationResult> => {
  // 记录发布配置信息（隐藏敏感信息）
  logger.info(`开始发布任务`, {
    packageCount: publishList.length,
    workingDirectory: cwd,
    publishUrl: url,
    authFormat: auth.includes(':') ? 'username:password' : '格式错误',
    concurrency: limit,
  });

  const bar = new ProgressBar('[progress] [:bar] :percent :pkg', {
    total: publishList.length + 1,
    complete: '=',
    incomplete: ' ',
    width: 40,
  });

  const result: OperationResult = {
    success: 0,
    failed: [],
  };

  await asyncFn(
    publishList,
    async (pkg: string) => {
      try {
        // 检查文件是否存在
        const fs = await import('fs/promises');
        const path = await import('path');
        const fullPath = path.join(cwd, pkg);

        try {
          await fs.access(fullPath);
        } catch {
          throw new Error(`文件不存在: ${fullPath}`);
        }

        // 使用辅助函数构建curl命令
        const curl = buildCurlCommand(auth, url, pkg);

        await execCurl(curl, { cwd });
        result.success++;
      } catch (err: unknown) {
        const error = err as Error;
        const msg = `发布错误 ${pkg} - ${error.message}`;
        bar.interrupt(msg);
        fileLogger.error(msg);
        result.failed.push(msg);
      } finally {
        bar.tick({ pkg });
      }
    },
    limit
  );

  bar.update(1, { pkg: '' });

  // 记录发布结果摘要
  const summary = {
    total: publishList.length,
    success: result.success,
    failed: result.failed.length,
    successRate: `${((result.success / publishList.length) * 100).toFixed(2)}%`,
  };

  logger.info(`发布完成: ${JSON.stringify(summary)}`);

  if (result.failed.length > 0) {
    logger.error(`失败的包列表:`, result.failed);
  }

  return result;
};

/**
 * 发布服务类 - 优化版本
 */
export class PublishService {
  private packageManager: DefaultPackageManager | null = null;

  /**
   * 获取远程仓库的包列表（保留兼容性，但标记为废弃）
   * @deprecated 建议使用新的包管理器进行单包检查，避免全量扫描
   * @param publishURL 发布服务URL
   * @returns 包名列表
   */
  async getPackageList(publishURL: string): Promise<string[]> {
    enhancedLogger.warn('使用了废弃的getPackageList方法，建议迁移到新的包管理器');
    return getPkgListFromService(publishURL);
  }

  /**
   * 发布包到远程仓库（兼容旧接口）
   * @deprecated 建议使用publishPackagesOptimized方法获得更好的性能
   * @param packages 要发布的包列表
   * @param config 发布配置
   * @returns 发布结果
   */
  async publishPackages(packages: string[], config: PublishConfig): Promise<OperationResult> {
    enhancedLogger.warn('使用了兼容模式的publishPackages方法，建议使用publishPackagesOptimized');
    return publish(packages, config.publishDir, config.publishUrl, config.publishAuth, config.threadNumber);
  }

  /**
   * 使用优化的包管理器发布包（推荐方法）
   * @param config 优化的发布配置
   * @returns 发布结果
   */
  async publishPackagesOptimized(config: OptimizedPublishConfig): Promise<OperationResult> {
    try {
      // 创建包管理器配置
      const managerConfig: PackageManagerConfig = {
        publishDir: config.publishDir,
        publishUrl: config.publishUrl,
        publishAuth: config.publishAuth,
        threadNumber: config.threadNumber,
        enableDetailedLogging: config.enableDetailedLogging ?? false,
        maxConcurrency: config.threadNumber,
        ...(config.scanPattern && { scanPattern: config.scanPattern }),
        ...(config.requestTimeout && { requestTimeout: config.requestTimeout }),
        ...(config.connectTimeout && { connectTimeout: config.connectTimeout }),
        ...(config.skipExistenceCheck !== undefined && { skipExistenceCheck: config.skipExistenceCheck }),
      };

      // 创建或重用包管理器实例
      if (!this.packageManager) {
        this.packageManager = new DefaultPackageManager(managerConfig);
      }

      // 执行优化的发布流程
      return await this.packageManager.publishPackages(config);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      enhancedLogger.error('优化发布流程执行失败', { error: errorMessage });

      return {
        success: 0,
        failed: [`优化发布流程执行失败: ${errorMessage}`],
      };
    }
  }

  /**
   * 自动选择发布方法（智能模式）
   * 根据配置自动选择使用优化版本还是兼容版本
   * @param config 发布配置
   * @param packages 包列表（可选，如果提供则使用兼容模式）
   * @returns 发布结果
   */
  async publishPackagesAuto(config: OptimizedPublishConfig, packages?: string[]): Promise<OperationResult> {
    if (packages && packages.length > 0) {
      // 如果提供了包列表，使用兼容模式
      enhancedLogger.info('检测到包列表参数，使用兼容模式发布');
      return this.publishPackages(packages, config);
    } else {
      // 否则使用优化模式
      enhancedLogger.info('使用优化模式发布');
      return this.publishPackagesOptimized(config);
    }
  }

  /**
   * 获取包管理器实例（用于高级操作）
   * @param config 配置
   * @returns 包管理器实例
   */
  getPackageManager(config: PackageManagerConfig): DefaultPackageManager {
    if (!this.packageManager) {
      this.packageManager = new DefaultPackageManager(config);
    }
    return this.packageManager;
  }

  /**
   * 重置包管理器实例
   */
  resetPackageManager(): void {
    this.packageManager = null;
  }
}

/**
 * 创建优化的发布服务实例
 * @param config 配置选项
 * @returns 发布服务实例
 */
export function createPublishService(config?: Partial<OptimizedPublishConfig>): PublishService {
  const service = new PublishService();

  if (config) {
    // 预初始化包管理器
    const managerConfig: PackageManagerConfig = {
      publishDir: config.publishDir || '',
      publishUrl: config.publishUrl || '',
      publishAuth: config.publishAuth || '',
      threadNumber: config.threadNumber || 3,
      enableDetailedLogging: config.enableDetailedLogging ?? false,
      maxConcurrency: config.threadNumber || 3,
      ...(config.scanPattern && { scanPattern: config.scanPattern }),
      ...(config.requestTimeout && { requestTimeout: config.requestTimeout }),
      ...(config.connectTimeout && { connectTimeout: config.connectTimeout }),
      ...(config.skipExistenceCheck !== undefined && { skipExistenceCheck: config.skipExistenceCheck }),
    };

    service.getPackageManager(managerConfig);
  }

  return service;
}

/**
 * 便捷函数：直接使用优化模式发布包
 * @param config 发布配置
 * @returns 发布结果
 */
export async function publishPackagesOptimized(config: OptimizedPublishConfig): Promise<OperationResult> {
  const service = createPublishService();
  return service.publishPackagesOptimized(config);
}

/**
 * 便捷函数：自动选择发布模式
 * @param config 发布配置
 * @param packages 包列表（可选）
 * @returns 发布结果
 */
export async function publishPackagesAuto(
  config: OptimizedPublishConfig,
  packages?: string[]
): Promise<OperationResult> {
  const service = createPublishService();
  return service.publishPackagesAuto(config, packages);
}

/**
 * 默认发布服务实例
 */
export const publishService = new PublishService();

/**
 * 迁移指南注释
 *
 * 从旧版本迁移到新版本的建议：
 *
 * 1. 旧方式（不推荐）：
 *    const result = await publishService.publishPackages(packages, config);
 *
 * 2. 新方式（推荐）：
 *    const result = await publishService.publishPackagesOptimized(config);
 *    或
 *    const result = await publishPackagesOptimized(config);
 *
 * 3. 自动选择方式：
 *    const result = await publishService.publishPackagesAuto(config);
 *
 * 新方式的优势：
 * - 自动扫描.tgz文件，无需手动提供包列表
 * - 单包存在性检查，避免全量仓库扫描
 * - 更好的并发控制和错误处理
 * - 详细的进度跟踪和日志记录
 * - 使用fetch API替代curl，更稳定的网络请求
 */
