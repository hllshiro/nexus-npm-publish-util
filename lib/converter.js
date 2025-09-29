import { createLock as convertPnpmStringToNpmObject } from './createLock.ts'

/**
 * 这是一个重构后的纯函数，用于将 pnpm-lock.yaml 的内容转换为 package-lock.json 的内容。
 * @param {string} pnpmLockContent - pnpm-lock.yaml 文件的字符串内容。
 * @returns {string} - 代表 package-lock.json 的 JSON 字符串。
 */
export function convert(pnpmLockContent) {
  // 1. 调用从源码中提取的核心转换逻辑
  // 注意：原始的 createLock 函数接收的是已经 parse 过的对象，但这里我们接收字符串
  // 我们需要先解析 yaml
  // 修正：原始的 createLock 函数接收的也是字符串，它内部做的parse
  const npmLockObject = convertPnpmStringToNpmObject(pnpmLockContent)

  // 2. 将得到的JS对象转换为JSON字符串
  return JSON.stringify(npmLockObject, null, 2)
}
