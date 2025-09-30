/**
 * Bun test 模块类型声明
 */

declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>, timeout?: number): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;

  export interface ExpectStatic {
    (actual: any): Matchers;
  }

  export interface Matchers {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toContain(expected: any): void;
    toThrow(expected?: string | RegExp | Error): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    rejects: {
      toThrow(expected?: string | RegExp | Error): Promise<void>;
    };
  }

  export const expect: ExpectStatic;
}
