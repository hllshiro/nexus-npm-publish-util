/**
 * 平滑ETA计算器 - 使用滑动窗口+EWMA算法，消除ETA跳变
 *
 * 核心思路：
 * 1. 滑动窗口：仅使用最近N个采样点计算瞬时速率，避免冷启动和历史数据干扰
 * 2. EWMA（指数加权移动平均）：对瞬时速率做指数平滑，抑制个别异常值导致的突变
 * 3. 最小采样阈值：窗口内样本不足时返回null，避免早期ETA大幅跳变
 */

interface Sample {
  completed: number;
  timestamp: number;
}

export interface SmoothETAOptions {
  /** 滑动窗口大小（采样点数量），越大越平滑但响应越慢 */
  windowSize?: number;
  /** EWMA平滑因子 (0,1]，越小越平滑但响应越慢 */
  alpha?: number;
  /** 开始显示ETA所需的最少完成数量 */
  minCompleted?: number;
}

export class SmoothETA {
  private readonly windowSize: number;
  private readonly alpha: number;
  private readonly minCompleted: number;
  private samples: Sample[] = [];
  private smoothedRate: number | null = null;

  constructor(options?: SmoothETAOptions) {
    this.windowSize = options?.windowSize ?? 20;
    this.alpha = options?.alpha ?? 0.3;
    this.minCompleted = options?.minCompleted ?? 3;
  }

  /**
   * 记录一个采样点
   * @param completed 当前已完成的总数量
   */
  addSample(completed: number): void {
    this.samples.push({ completed, timestamp: Date.now() });
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
  }

  /**
   * 计算当前瞬时速率（基于滑动窗口首尾差值）
   * @returns 每毫秒处理数量，样本不足时返回null
   */
  private getInstantRate(): number | null {
    if (this.samples.length < 2) return null;

    const first = this.samples[0]!;
    const last = this.samples[this.samples.length - 1]!;
    const deltaCount = last.completed - first.completed;
    const deltaTime = last.timestamp - first.timestamp;

    if (deltaCount <= 0 || deltaTime <= 0) return null;

    return deltaCount / deltaTime;
  }

  /**
   * 获取平滑后的处理速率（每毫秒）
   */
  private getSmoothedRate(): number | null {
    const instantRate = this.getInstantRate();
    if (instantRate === null) return null;

    if (this.smoothedRate === null) {
      this.smoothedRate = instantRate;
    } else {
      // EWMA: new = alpha * instant + (1-alpha) * previous
      this.smoothedRate = this.alpha * instantRate + (1 - this.alpha) * this.smoothedRate;
    }

    return this.smoothedRate;
  }

  /**
   * 获取ETA（秒）
   * @param totalCount 总数
   * @returns 预估剩余秒数，样本不足时返回null
   */
  getETA(totalCount: number): number | null {
    const last = this.samples[this.samples.length - 1];
    if (!last) return null;

    const remaining = totalCount - last.completed;
    if (remaining <= 0) return 0;

    // 样本不足时返回null，避免早期大幅跳变
    if (last.completed < this.minCompleted) return null;

    const rate = this.getSmoothedRate();
    if (rate === null || rate <= 0) return null;

    return Math.ceil(remaining / rate / 1000);
  }

  /**
   * 格式化ETA为人类可读字符串
   * @param totalCount 总数
   * @returns 格式化字符串，如 "12s"、"3m 24s"、"1h 12m"
   */
  formatETA(totalCount: number): string {
    const etaSec = this.getETA(totalCount);
    if (etaSec === null) return '--';

    if (etaSec < 60) return `${etaSec}s`;

    const hours = Math.floor(etaSec / 3600);
    const minutes = Math.floor((etaSec % 3600) / 60);
    const seconds = etaSec % 60;

    if (hours > 0) {
      return seconds > 0 ? `${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
    }
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  /**
   * 重置计算器状态
   */
  reset(): void {
    this.samples = [];
    this.smoothedRate = null;
  }
}

/**
 * 创建SmoothETA实例
 */
export function createSmoothETA(options?: SmoothETAOptions): SmoothETA {
  return new SmoothETA(options);
}
