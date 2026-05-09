/**
 * Registry URL解析工具
 * 用于解析CLI中输入的registry参数，提取baseURL和repository信息
 */

import type { RegistryUrlInfo } from '@/types/index.ts';

/**
 * 解析registry URL，提取baseURL和repository参数
 *
 * @param registryUrl - 输入的registry URL，格式应为: ${BASEURL}/repository/{repository}/
 * @returns 解析结果
 */
export function parseRegistryUrl(registryUrl: string): RegistryUrlInfo {
  if (!registryUrl || typeof registryUrl !== 'string') {
    throw new Error('Registry URL不能为空');
  }

  // 确保URL以/结尾
  const normalizedUrl = registryUrl.endsWith('/') ? registryUrl : `${registryUrl}/`;

  // 验证URL格式
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    throw new Error('Registry URL格式错误，应以 http:// 或 https:// 开头');
  }

  // 使用正则表达式匹配格式: ${BASEURL}/repository/{repository}/
  const registryPattern = /^(https?:\/\/[^/]+)\/repository\/([^/]+)\/$/;
  const match = normalizedUrl.match(registryPattern);

  if (!match) {
    throw new Error(
      `Registry URL格式错误，应符合格式: \${BASEURL}/repository/{repository}/\n` +
        `例如: http://localhost/repository/npm/\n` +
        `实际输入: ${registryUrl}`
    );
  }

  const baseUrlWithoutSlash = match[1];
  const repository = match[2];

  if (!baseUrlWithoutSlash || !repository) {
    throw new Error('URL解析失败：无法提取baseUrl或repository');
  }
  const baseUrl = `${baseUrlWithoutSlash}/`;

  return {
    baseUrl,
    repository,
    fullUrl: normalizedUrl,
  };
}

/**
 * 构建上传URL
 *
 * @param baseUrl - 基础URL，例如: http://localhost:8081/
 * @param repository - 仓库名称，例如: npm
 * @returns 上传URL，格式为: ${BASEURL}/service/rest/v1/components?repository=${repository}
 */
export function buildUploadUrl(baseUrl: string, repository: string): string {
  if (!baseUrl || !repository) {
    throw new Error('baseUrl和repository参数不能为空');
  }

  // 确保baseUrl以/结尾
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  return `${normalizedBaseUrl}service/rest/v1/components?repository=${repository}`;
}

/**
 * 从registry URL直接构建上传URL
 *
 * @param registryUrl - Registry URL
 * @returns 上传URL
 */
export function buildUploadUrlFromRegistry(registryUrl: string): string {
  const { baseUrl, repository } = parseRegistryUrl(registryUrl);
  return buildUploadUrl(baseUrl, repository);
}

/**
 * 确保URL以斜杠结尾
 *
 * @param url - 输入的URL
 * @returns 以斜杠结尾的URL
 */
export function ensureUrlEndsWithSlash(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error('URL不能为空');
  }

  return url.endsWith('/') ? url : `${url}/`;
}
