/**
 * 增强版进度条工具类 - 支持进度条期间的日志输出
 * 使用cli-progress的MultiBar.log()方法解决日志与进度条冲突问题
 */

import * as cliProgress from 'cli-progress';
import chalk from 'chalk';
import process from 'node:process';
import type { ProgressBarOptions } from '@/types/index.ts';
import { SmoothETA } from './smooth-eta.ts';

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
 * 增强版进度条工具类
 * 支持在进度条运行期间输出日志而不干扰显示
 */
export class ProgressBar {
  private multiBar: cliProgress.MultiBar | null = null;
  private progressBar: cliProgress.SingleBar | null = null;
  private options: Required<ProgressBarOptions>;
  private isActive: boolean = false;
  private supportsProgress: boolean;
  private readonly smoothETA: SmoothETA;

  constructor(options: ProgressBarOptions) {
    this.options = {
      title: options.title,
      total: options.total,
      enableColor: options.enableColor ?? true,
      barWidth: options.barWidth ?? 40,
      enableLogging: options.enableLogging ?? true,
    };
    this.supportsProgress = supportsProgressBar();
    this.smoothETA = new SmoothETA({ minCompleted: 3 });
  }

  /**
   * 启动进度条
   */
  start(): void {
    if (this.isActive || !this.supportsProgress) {
      return;
    }

    // 重置ETA计算器状态
    this.smoothETA.reset();

    // 配置进度条样式 - 使用自定义smoothETA替代cli-progress内置eta，消除跳变
    const format = this.options.enableColor
      ? `${chalk.cyan(this.options.title)} ${chalk.green('[{bar}]')} {percentage}% | {value}/{total} | ETA: {smoothETA}`
      : `${this.options.title} [{bar}] {percentage}% | {value}/{total} | ETA: {smoothETA}`;

    const barConfig = {
      format,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: true,
      stopOnComplete: false, // 手动控制停止
      barsize: this.options.barWidth,
      stream: process.stderr,
      noTTYOutput: !this.supportsProgress,
      notTTYSchedule: 1000,
      synchronousUpdate: false,
      fps: 10,
    };

    // 始终使用MultiBar以支持日志输出
    this.multiBar = new cliProgress.MultiBar(barConfig, cliProgress.Presets.shades_classic);
    this.progressBar = this.multiBar.create(this.options.total, 0);
    this.isActive = true;
  }

  /**
   * 更新进度
   * @param current 当前进度值
   * @param payload 额外的显示信息
   */
  update(current: number, payload?: Record<string, unknown>): void {
    if (!this.progressBar || !this.isActive || !this.supportsProgress) {
      return;
    }

    this.smoothETA.addSample(current);
    const smoothETA = this.smoothETA.formatETA(this.options.total);
    this.progressBar.update(current, { ...payload, smoothETA });
  }

  /**
   * 增加进度
   * @param increment 增加的数量，默认为1
   * @param payload 额外的显示信息
   */
  increment(increment: number = 1, payload?: Record<string, unknown>): void {
    if (!this.progressBar || !this.isActive || !this.supportsProgress) {
      return;
    }

    const currentValue = this.progressBar.value + increment;
    this.smoothETA.addSample(currentValue);
    const smoothETA = this.smoothETA.formatETA(this.options.total);
    this.progressBar.increment(increment, { ...payload, smoothETA });
  }

  /**
   * 在进度条上方输出日志信息
   * 这是关键方法：使用MultiBar.log()在进度条期间安全输出日志
   * @param message 日志消息（必须以\n结尾）
   */
  log(message: string): void {
    if (!this.multiBar || !this.isActive || !this.supportsProgress) {
      // 如果进度条不活跃，直接输出到控制台
      console.error(message.endsWith('\n') ? message.slice(0, -1) : message);
      return;
    }

    // 确保消息以换行符结尾
    const formattedMessage = message.endsWith('\n') ? message : message + '\n';
    this.multiBar.log(formattedMessage);
  }

  /**
   * 停止进度条
   */
  stop(): void {
    if (!this.multiBar || !this.isActive || !this.supportsProgress) {
      this.isActive = false;
      return;
    }

    this.multiBar.stop();
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
    return this.progressBar?.value ?? 0;
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
    if (this.progressBar && this.isActive) {
      this.progressBar.setTotal(total);
    }
  }
}

/**
 * 创建增强版进度条实例
 */
export function createProgressBar(options: ProgressBarOptions): ProgressBar {
  return new ProgressBar(options);
}
