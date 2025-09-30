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

/**
 * 并发执行任务并返回结果
 * @param {Array<T>} arr 任务列表
 * @param {Function} fn 任务函数
 * @param {number} limit 并发数，默认1
 * @returns {Promise<R[]>} 执行结果
 */
export const asyncResult = <T, R>(arr: T[], fn: (item: T) => Promise<R>, limit: number = 1): Promise<R[]> => {
  const args = [...arr];
  const results: R[] = [];
  let runningCount = 0;
  let resultIndex = 0;
  let resultCount = 0;

  return new Promise((resolve) => {
    function run(): void {
      while (runningCount < limit && args.length > 0) {
        runningCount++;
        ((i: number): void => {
          const v = args.shift();
          if (!v) return;
          fn(v)
            .then(
              (val: R) => {
                results[i] = val;
              },
              () => {
                throw new Error(`An error occurred: ${String(v)}`);
              }
            )
            .finally(() => {
              runningCount--;
              resultCount++;
              if (resultCount === arr.length) {
                resolve(results);
              } else {
                run();
              }
            });
        })(resultIndex++);
      }
    }
    run();
  });
};
