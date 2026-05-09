import fg from 'fast-glob';
import type { PackageScanner } from '@/types/index.ts';

/**
 * 基于fast-glob的包扫描器实现
 * 提供高性能的异步文件扫描功能
 */
export class FastGlobPackageScanner implements PackageScanner {
  /**
   * 扫描指定目录下的所有.tgz文件
   * @param directory 扫描目录
   * @returns 文件路径列表
   */
  async scanPackages(directory: string): Promise<string[]> {
    try {
      // 使用forward-slash格式的glob模式，确保跨平台兼容性
      const normalizedDirectory = directory.replace(/\\/g, '/');
      const pattern = `${normalizedDirectory}/**/*.tgz`;

      const files = await fg(pattern, {
        onlyFiles: true, // 只返回文件，不包括目录
        absolute: true, // 返回绝对路径
        unique: true, // 去重
        followSymbolicLinks: false, // 不跟随符号链接，避免循环引用
        suppressErrors: true, // 容错处理，忽略权限错误等
        ignore: [
          // 忽略模式
          '**/node_modules/**', // 忽略node_modules目录
          '**/.git/**', // 忽略git目录
          '**/temp/**', // 忽略临时目录
          '**/tmp/**', // 忽略临时目录
        ],
        dot: false, // 不匹配以.开头的文件
        caseSensitiveMatch: false, // 不区分大小写匹配
      });

      return files;
    } catch (error) {
      // 记录错误但不中断程序执行
      console.error(`扫描目录失败: ${directory}`, error);
      return [];
    }
  }


}
