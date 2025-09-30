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
 * 执行curl命令
 * @param curl curl命令
 * @param options 执行选项
 * @returns 执行结果
 */
const execCurl = async (curl: string, options: { cwd: string }): Promise<void> => {
  return new Promise((resolve, reject) => {
    exec(curl, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        // 检查响应内容，确保不是HTML错误页面
        if (stdout && stdout.includes('<html>')) {
          reject(new Error('服务器返回HTML页面，可能是错误的仓库地址'));
        } else if (stderr && stderr.trim()) {
          reject(new Error(`curl错误: ${stderr}`));
        } else {
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
        const curl = `curl -u ${auth} -X POST "${url}" -H "Accept: application/json" -H "Content-Type:multipart/form-data" -F "npm.asset=@${pkg};type=application/x-compressed"`;
        await execCurl(curl, { cwd });
        result.success++;
      } catch (err) {
        const error = err as Error;
        const msg = `发布错误: ${pkg} - ${error.message}`;
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
  logger.info('全部发布完成');
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
