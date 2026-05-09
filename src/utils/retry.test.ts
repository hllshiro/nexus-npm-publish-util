import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { withRetry, calculateDelay } from './retry.ts';

Deno.test('calculateDelay: 指数退避递增', () => {
  const base = 1000;
  const max = 10000;
  // 测试多次取最小值（抖动下限为 75%）
  const d0 = calculateDelay(0, base, max);
  const d1 = calculateDelay(1, base, max);
  const d2 = calculateDelay(2, base, max);
  // d0 应约 750-1000, d1 约 1500-2000, d2 约 3000-4000
  assertEquals(d0 >= 750 && d0 <= 1000, true, `d0=${d0}`);
  assertEquals(d1 >= 1500 && d1 <= 2000, true, `d1=${d1}`);
  assertEquals(d2 >= 3000 && d2 <= 4000, true, `d2=${d2}`);
});

Deno.test('calculateDelay: 不超过maxDelay', () => {
  const delay = calculateDelay(10, 1000, 5000);
  assertEquals(delay <= 5000, true, `delay=${delay}`);
});

Deno.test('withRetry: 首次成功不重试', () => {
  let calls = 0;
  return withRetry(
    () => {
      calls++;
      return Promise.resolve('ok');
    },
    { maxAttempts: 3, baseDelay: 1, maxDelay: 1, operationName: 'test' }
  ).then((result) => {
    assertEquals(result, 'ok');
    assertEquals(calls, 1);
  });
});

Deno.test('withRetry: 失败后重试成功', () => {
  let calls = 0;
  return withRetry(
    () => {
      calls++;
      if (calls < 3) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    },
    { maxAttempts: 3, baseDelay: 1, maxDelay: 1, operationName: 'test' }
  ).then((result) => {
    assertEquals(result, 'ok');
    assertEquals(calls, 3);
  });
});

Deno.test('withRetry: 全部失败抛出最后一次错误', () => {
  let calls = 0;
  return withRetry(
    () => {
      calls++;
      return Promise.reject(new Error(`fail-${calls}`));
    },
    { maxAttempts: 3, baseDelay: 1, maxDelay: 1, operationName: 'test' }
  ).then(
    () => {
      throw new Error('should have thrown');
    },
    (e) => {
      assertEquals((e as Error).message, 'fail-3');
      assertEquals(calls, 3);
    }
  );
});

Deno.test('withRetry: retryableCheck 返回 false 时不重试', () => {
  let calls = 0;
  return withRetry(
    () => {
      calls++;
      return Promise.reject(new Error('no-retry'));
    },
    {
      maxAttempts: 3,
      baseDelay: 1,
      maxDelay: 1,
      operationName: 'test',
      retryableCheck: () => false,
    }
  ).then(
    () => {
      throw new Error('should have thrown');
    },
    (e) => {
      assertEquals((e as Error).message, 'no-retry');
      assertEquals(calls, 1);
    }
  );
});
