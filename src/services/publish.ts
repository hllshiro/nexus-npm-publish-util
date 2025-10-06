/**
 * 发布服务 - 迁移自 util/publish.js
 * 提供包发布到 Nexus 仓库的功能
 */

import * as http from 'node:http';
import * as https from 'node:https';
import { exec } from 'node:child_process';
import ProgressBar from 'progress';
import { fileLogger, logger } from '../utils/logger.js';
import { asyncFn } from '../utils/task.js';
import type { PublishConfig, OperationResult, ServicePackageItem, ServicePackageListResponse } from '../types/index.js';

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
      } catch (err) {
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
 * 发布服务类
 */
export class PublishService {
  /**
   * 获取远程仓库的包列表
   * @param publishURL 发布服务URL
   * @returns 包名列表
   */
  async getPackageList(publishURL: string): Promise<string[]> {
    return getPkgListFromService(publishURL);
  }

  /**
   * 发布包到远程仓库
   * @param packages 要发布的包列表
   * @param config 发布配置
   * @returns 发布结果
   */
  async publishPackages(packages: string[], config: PublishConfig): Promise<OperationResult> {
    return publish(packages, config.publishDir, config.publishUrl, config.publishAuth, config.threadNumber);
  }
}

/**
 * 默认发布服务实例
 */
export const publishService = new PublishService();
