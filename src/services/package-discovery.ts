import type { PackageInfo } from '../types/package.js';
import { FastGlobPackageScanner } from './package-scanner.js';
import { TarPackageInfoExtractor } from './package-info-extractor.js';

/**
 * 包发现服务
 * 整合文件扫描和包信息提取功能
 */
export class PackageDiscoveryService {
  private scanner: FastGlobPackageScanner;
  private extractor: TarPackageInfoExtractor;

  constructor() {
    this.scanner = new FastGlobPackageScanner();
    this.extractor = new TarPackageInfoExtractor();
  }

  /**
   * 发现指定目录下的所有包
   * @param directory 扫描目录
   * @returns 包信息列表
   */
  async discoverPackages(directory: string): Promise<PackageInfo[]> {
    try {
      console.log(`开始扫描目录: ${directory}`);

      // 验证目录
      if (!(await this.scanner.validateDirectory(directory))) {
        throw new Error(`无效的目录: ${directory}`);
      }

      // 扫描.tgz文件
      const tgzFiles = await this.scanner.scanPackages(directory);
      console.log(`找到 ${tgzFiles.length} 个.tgz文件`);

      if (tgzFiles.length === 0) {
        return [];
      }

      // 提取包信息
      console.log('开始提取包信息...');
      const packageInfos = await this.extractor.extractMultiplePackageInfo(tgzFiles);

      // 验证包信息
      const validPackages = packageInfos.filter((pkg) => this.extractor.validatePackageInfo(pkg));

      console.log(`成功解析 ${validPackages.length} 个有效包`);

      if (validPackages.length !== packageInfos.length) {
        const invalidCount = packageInfos.length - validPackages.length;
        console.warn(`跳过 ${invalidCount} 个无效包`);
      }

      return validPackages;
    } catch (error) {
      console.error(`包发现失败: ${directory}`, error);
      throw error;
    }
  }

  /**
   * 获取发现统计信息
   * @param directory 扫描目录
   * @returns 统计信息
   */
  async getDiscoveryStats(directory: string): Promise<{
    totalTgzFiles: number;
    validPackages: number;
    invalidPackages: number;
    scannedDirectories: number;
  }> {
    try {
      const scanStats = await this.scanner.getScanStats(directory);
      const tgzFiles = await this.scanner.scanPackages(directory);
      const packageInfos = await this.extractor.extractMultiplePackageInfo(tgzFiles);
      const validPackages = packageInfos.filter((pkg) => this.extractor.validatePackageInfo(pkg));

      // 无效包数量 = 总tgz文件数 - 有效包数量
      const invalidPackages = tgzFiles.length - validPackages.length;

      return {
        totalTgzFiles: scanStats.totalFiles,
        validPackages: validPackages.length,
        invalidPackages: invalidPackages,
        scannedDirectories: scanStats.scannedDirectories,
      };
    } catch (error) {
      console.error(`获取发现统计信息失败: ${directory}`, error);
      return {
        totalTgzFiles: 0,
        validPackages: 0,
        invalidPackages: 0,
        scannedDirectories: 0,
      };
    }
  }

  /**
   * 按包名分组
   * @param packages 包信息列表
   * @returns 按包名分组的包信息
   */
  groupPackagesByName(packages: PackageInfo[]): Map<string, PackageInfo[]> {
    const grouped = new Map<string, PackageInfo[]>();

    for (const pkg of packages) {
      const existing = grouped.get(pkg.packageName) || [];
      existing.push(pkg);
      grouped.set(pkg.packageName, existing);
    }

    return grouped;
  }

  /**
   * 查找重复的包（相同名称和版本）
   * @param packages 包信息列表
   * @returns 重复的包信息
   */
  findDuplicatePackages(packages: PackageInfo[]): PackageInfo[] {
    const seen = new Set<string>();
    const duplicates: PackageInfo[] = [];

    for (const pkg of packages) {
      const key = `${pkg.packageName}@${pkg.version}`;
      if (seen.has(key)) {
        duplicates.push(pkg);
      } else {
        seen.add(key);
      }
    }

    return duplicates;
  }
}
