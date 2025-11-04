/**
 * 进度条工具类 - 使用cli-progress库提供更好的ANSI兼容性
 * 解决与彩色日志输出冲突的问题
 */

import * as cliProgress from 'cli-progress';
import chalk from 'chalk';
import process from 'node:process';

/**
 * 检测终端是否支持进度条显示
 */
function supportsProgressBar(): boolean {
  // 检查是否为TTY
  if (!process.stderr.isTTY) {
    return false;
  }

  // 检查环境变量
  if (process.env.CI || process.env.NO_PROGRESS) {
    return false;
  }

  // 检查终端类型
  const term = process.env.TERM;
  if (term === 'dumb') {
    return false;
  }

  return true;
}

/**
 * 进度条配置选项
 */
export interface ProgressBarOptions {
  /** 进度条标题 */
  title: string;
  /** 总数 */
  total: number;
  /** 是否启用颜色 */
  enableColor?: boolean;
  /** 进度条宽度 */
  barWidth?: number;
}

/**
 * 进度条工具类
 * 提供与彩色日志兼容的进度条显示功能
 */
export class ProgressBarUtil {
  private bar: cliProgress.SingleBar | null = null;
  private options: Required<ProgressBarOptions>;
  private isActive: boolean = false;
  private supportsProgress: boolean;

  constructor(options: ProgressBarOptions & { enableLogging?: boolean }) {
    this.options = {
      title: options.title,
      total: options.total,
      enableColor: options.enableColor ?? true,
      barWidth: options.barWidth ?? 40,
    };
    this.supportsProgress = supportsProgressBar();
  }

  /**
   * 启动进度条
   */
  start(): void {
    if (this.isActive || !this.supportsProgress) {
      return;
    }

    // 配置进度条样式
    const format = this.options.enableColor
      ? `${chalk.cyan(this.options.title)} ${chalk.green('[{bar}]')} {percentage}% | {value}/{total} | ETA: {eta}s`
      : `${this.options.title} [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s`;

    // 创建进度条实例
    this.bar = new cliProgress.SingleBar(
      {
        format,
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
        clearOnComplete: true,
        stopOnComplete: true,
        barsize: this.options.barWidth,
        // 使用stderr避免与日志输出冲突
        stream: process.stderr,
        // 启用ANSI转义序列支持
        noTTYOutput: !this.supportsProgress,
        notTTYSchedule: 1000,
        // 添加同步刷新，减少与日志输出的冲突
        synchronousUpdate: false,
        // 设置更新频率限制
        fps: 10,
      },
      cliProgress.Presets.shades_classic
    );
    this.bar.start(this.options.total, 0);
    this.isActive = true;
  }

  /**
   * 更新进度
   * @param current 当前进度值
   * @param payload 额外的显示信息
   */
  update(current: number, payload?: Record<string, unknown>): void {
    if (!this.bar || !this.isActive || !this.supportsProgress) {
      return;
    }

    this.bar.update(current, payload);
  }

  /**
   * 增加进度
   * @param increment 增加的数量，默认为1
   * @param payload 额外的显示信息
   */
  increment(increment: number = 1, payload?: Record<string, unknown>): void {
    if (!this.bar || !this.isActive || !this.supportsProgress) {
      return;
    }

    this.bar.increment(increment, payload);
  }

  /**
   * 停止进度条
   */
  stop(): void {
    if (!this.bar || !this.isActive || !this.supportsProgress) {
      this.isActive = false;
      return;
    }

    this.bar.stop();
    this.isActive = false;

    // 确保光标恢复显示
    if (process.stderr.isTTY) {
      process.stderr.write('\x1B[?25h'); // 显示光标
    }
  }

  /**
   * 获取当前进度值
   */
  getValue(): number {
    return this.bar?.value ?? 0;
  }

  /**
   * 获取总数
   */
  getTotal(): number {
    return this.options.total;
  }

  /**
   * 检查进度条是否活跃
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * 设置新的总数
   * @param total 新的总数
   */
  setTotal(total: number): void {
    this.options.total = total;
    if (this.bar && this.isActive) {
      this.bar.setTotal(total);
    }
  }
}

/**
 * 多进度条管理器
 * 用于同时显示多个进度条
 */
export class MultiProgressBarUtil {
  private multiBar: cliProgress.MultiBar | null = null;
  private bars: Map<string, cliProgress.SingleBar> = new Map();
  private isActive: boolean = false;
  private enableColor: boolean;

  constructor(enableColor: boolean = true) {
    this.enableColor = enableColor;
  }

  /**
   * 启动多进度条
   */
  start(): void {
    if (this.isActive) {
      return;
    }

    this.multiBar = new cliProgress.MultiBar(
      {
        clearOnComplete: true,
        hideCursor: true,
        stream: process.stderr,
        noTTYOutput: false,
        notTTYSchedule: 1000,
      },
      cliProgress.Presets.shades_classic
    );

    this.isActive = true;
  }

  /**
   * 添加一个进度条
   * @param key 进度条标识
   * @param options 进度条选项
   */
  addBar(key: string, options: ProgressBarOptions): void {
    if (!this.multiBar || !this.isActive) {
      return;
    }

    const format = this.enableColor
      ? `${chalk.cyan(options.title)} ${chalk.green('[{bar}]')} {percentage}% | {value}/{total}`
      : `${options.title} [{bar}] {percentage}% | {value}/{total}`;

    const bar = this.multiBar.create(
      options.total,
      0,
      {},
      {
        format,
        barCompleteChar: '█',
        barIncompleteChar: '░',
        barsize: options.barWidth ?? 30,
      }
    );

    this.bars.set(key, bar);
  }

  /**
   * 更新指定进度条
   * @param key 进度条标识
   * @param current 当前进度值
   * @param payload 额外信息
   */
  updateBar(key: string, current: number, payload?: Record<string, unknown>): void {
    const bar = this.bars.get(key);
    if (bar) {
      bar.update(current, payload);
    }
  }

  /**
   * 增加指定进度条的进度
   * @param key 进度条标识
   * @param increment 增加的数量
   * @param payload 额外信息
   */
  incrementBar(key: string, increment: number = 1, payload?: Record<string, unknown>): void {
    const bar = this.bars.get(key);
    if (bar) {
      bar.increment(increment, payload);
    }
  }

  /**
   * 停止所有进度条
   */
  stop(): void {
    if (!this.multiBar || !this.isActive) {
      return;
    }

    this.multiBar.stop();
    this.bars.clear();
    this.isActive = false;
  }

  /**
   * 移除指定的进度条
   * @param key 进度条标识
   */
  removeBar(key: string): void {
    const bar = this.bars.get(key);
    if (bar && this.multiBar) {
      this.multiBar.remove(bar);
      this.bars.delete(key);
    }
  }
}

/**
 * 创建单个进度条实例
 */
export function createProgressBar(options: ProgressBarOptions): ProgressBarUtil {
  return new ProgressBarUtil(options);
}

/**
 * 创建多进度条管理器实例
 */
export function createMultiProgressBar(enableColor: boolean = true): MultiProgressBarUtil {
  return new MultiProgressBarUtil(enableColor);
}
