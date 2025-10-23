/**
 * 并发执行任务
 * @param {Array<T>} arr 任务列表
 * @param {Function} fn 任务函数
 * @param {number} limit 并发数，默认1
 * @returns {Promise<R[]>} 执行结果
 */
export const asyncFn = async <T, R>(arr: T[], fn: (item: T) => Promise<R>, limit: number = 1): Promise<R[]> => {
  const ret: Promise<R>[] = [];
  const executing: Promise<void>[] = [];

  for (const i of arr) {
    const promise = Promise.resolve().then(() => fn(i));
    ret.push(promise);

    if (limit <= arr.length) {
      const e = promise.then(() => {
        const index = executing.indexOf(e);
        if (index > -1) {
          executing.splice(index, 1);
        }
      });
      executing.push(e);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
};
