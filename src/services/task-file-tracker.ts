import type { PackageInfo, TaskFileData, TaskFileTracker } from '@/types/index.ts';
import { logger } from '@/utils/logger.ts';

/**
 * 任务文件格式版本
 */
const TASK_FILE_VERSION = '1.0.0';

/**
 * 生成包的唯一标识
 * @param packageName 包名
 * @param version 版本号
 * @returns 唯一标识字符串
 */
export function generatePackageKey(packageName: string, version: string): string {
  return `${packageName}@${version}`;
}

/**
 * 默认的任务文件跟踪器实现
 */
export class DefaultTaskFileTracker implements TaskFileTracker {
  private taskFilePath: string = '';
  private taskFileData: TaskFileData;
  private processedSet: Set<string>;

  constructor() {
    this.taskFileData = {
      version: TASK_FILE_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processedPackages: [],
      packageCache: {},
    };
    this.processedSet = new Set();
  }

  /**
   * 初始化跟踪器，加载现有任务文件
   * @param taskFilePath 任务文件路径
   */
  async initialize(taskFilePath: string): Promise<void> {
    this.taskFilePath = taskFilePath;

    try {
      if (await this.fileExists(taskFilePath)) {
        const fileContent = await Deno.readTextFile(taskFilePath);
        const data = JSON.parse(fileContent) as TaskFileData;

        if (!this.validateTaskFileData(data)) {
          logger.warn('任务文件格式无效，将创建新的任务文件');
          await this.backupCorruptedFile(taskFilePath);
          return;
        }

        // 兼容旧版本：缺少 packageCache 字段时补充空对象
        if (!data.packageCache) {
          data.packageCache = {};
        }

        this.taskFileData = data;
        this.processedSet = new Set(data.processedPackages);

        const cacheCount = Object.keys(data.packageCache).length;
        logger.info(`加载任务文件: ${taskFilePath}`);
        logger.info(`已处理包数量: ${this.processedSet.size}, 缓存包信息: ${cacheCount}`);
      } else {
        logger.info('未找到任务文件，将创建新的任务文件');
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.warn(`任务文件JSON格式错误: ${error.message}`);
        await this.backupCorruptedFile(taskFilePath);
      } else {
        logger.error(`读取任务文件失败: ${error}`);
        logger.warn('将继续正常流程，不跳过任何包');
      }
    }
  }

  /**
   * 检查包是否已被处理
   */
  isProcessed(packageKey: string): boolean {
    return this.processedSet.has(packageKey);
  }

  /**
   * 标记包为已处理
   */
  markAsProcessed(packageKey: string): void {
    if (!this.processedSet.has(packageKey)) {
      this.processedSet.add(packageKey);
      this.taskFileData.processedPackages.push(packageKey);
    }
  }

  /**
   * 保存任务文件
   */
  async save(): Promise<void> {
    if (!this.taskFilePath) {
      logger.warn('任务文件路径未设置，跳过保存');
      return;
    }

    try {
      this.taskFileData.updatedAt = new Date().toISOString();

      const path = await import('node:path');
      const dir = path.dirname(this.taskFilePath);

      try {
        await Deno.stat(dir);
      } catch {
        await Deno.mkdir(dir, { recursive: true });
      }

      const fileContent = JSON.stringify(this.taskFileData, null, 2);
      await Deno.writeTextFile(this.taskFilePath, fileContent);

      logger.info(`任务文件已保存: ${this.taskFilePath}`);
      logger.info(`总已处理包数: ${this.processedSet.size}`);
    } catch (error) {
      logger.error(`保存任务文件失败: ${error}`);
      logger.warn('任务文件保存失败不会影响发布流程');
    }
  }

  /**
   * 获取已处理包的数量
   */
  getProcessedCount(): number {
    return this.processedSet.size;
  }

  /**
   * 获取缓存的包信息
   * @param filePath 文件路径
   * @returns 缓存的包信息，不存在则返回 null
   */
  getCachedPackageInfo(filePath: string): PackageInfo | null {
    return this.taskFileData.packageCache[filePath] ?? null;
  }

  /**
   * 缓存包信息
   * @param filePath 文件路径
   * @param info 包信息
   */
  setCachedPackageInfo(filePath: string, info: PackageInfo): void {
    this.taskFileData.packageCache[filePath] = info;
  }

  /**
   * 验证任务文件数据格式
   */
  private validateTaskFileData(data: unknown): data is TaskFileData {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const taskData = data as Partial<TaskFileData>;

    if (
      typeof taskData.version !== 'string' ||
      typeof taskData.createdAt !== 'string' ||
      typeof taskData.updatedAt !== 'string' ||
      !Array.isArray(taskData.processedPackages)
    ) {
      return false;
    }

    if (!taskData.processedPackages.every((item: unknown) => typeof item === 'string')) {
      return false;
    }

    // packageCache 可选（兼容旧版本），但如果存在必须是对象
    if (taskData.packageCache !== undefined && typeof taskData.packageCache !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * 备份损坏的任务文件
   */
  private async backupCorruptedFile(taskFilePath: string): Promise<void> {
    try {
      const backupPath = `${taskFilePath}.backup`;
      const fileContent = await Deno.readTextFile(taskFilePath);
      await Deno.writeTextFile(backupPath, fileContent);
      logger.info(`已备份损坏的任务文件到: ${backupPath}`);
    } catch (error) {
      logger.warn(`备份损坏的任务文件失败: ${error}`);
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await Deno.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
