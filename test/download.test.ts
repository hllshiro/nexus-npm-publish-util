/**
 * Download模式功能测试
 * 测试四种下载模式：包名下载、文件列表下载、package.json下载、锁文件下载
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { App } from '../src/core/app.js';
import type { CliArgs } from '../src/types/index.js';

// 测试目录 - 统一使用 .test 目录
const TEST_ROOT_DIR = path.join(process.cwd(), '.test');
const DOWNLOAD_DIR = path.join(TEST_ROOT_DIR, 'download');
const TEMP_FILES_DIR = path.join(TEST_ROOT_DIR, 'temp');

// 清理测试环境
function cleanupTestEnv() {
  if (fs.existsSync(TEST_ROOT_DIR)) {
    fs.rmSync(TEST_ROOT_DIR, { recursive: true, force: true });
  }
}

// 确保测试目录存在
function ensureTestDirs() {
  if (!fs.existsSync(TEST_ROOT_DIR)) {
    fs.mkdirSync(TEST_ROOT_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMP_FILES_DIR)) {
    fs.mkdirSync(TEMP_FILES_DIR, { recursive: true });
  }
}

// 创建基础CLI配置
function createBaseConfig(): CliArgs {
  return {
    output: DOWNLOAD_DIR,
    publishDir: 'download',
    threadNumber: 1,
    force: false,
    legacyPeerDeps: false,
    publish: false,
    forcePublish: false,
  };
}

// 验证下载结果的辅助函数
function validateDownloadResult(downloadDir: string, expectedPackages: string[] = []) {
  expect(fs.existsSync(downloadDir)).toBe(true);

  const files = fs.readdirSync(downloadDir);

  // 如果没有下载到文件，但也没有期望的包，则认为是正常的（比如空的输入文件）
  if (files.length === 0 && expectedPackages.length === 0) {
    return files;
  }

  expect(files.length).toBeGreaterThan(0);

  // 验证所有文件都是.tgz格式
  files.forEach((file) => {
    expect(file.endsWith('.tgz')).toBe(true);
  });

  // 如果指定了期望的包，验证是否包含
  expectedPackages.forEach((packageName) => {
    expect(files.some((file) => file.includes(packageName))).toBe(true);
  });

  return files;
}

describe('Download Mode Tests', () => {
  beforeEach(() => {
    cleanupTestEnv();
    ensureTestDirs();
  });

  afterEach(() => {
    cleanupTestEnv();
  });

  describe('模式1: 包名下载 (--name)', () => {
    test('应该能够通过包名下载单个包', async () => {
      const config: CliArgs = {
        ...createBaseConfig(),
        name: 'lodash@4.17.21',
      };

      const app = new App(config);
      await app.downloadMode();

      // 验证下载结果
      const files = validateDownloadResult(DOWNLOAD_DIR, ['lodash']);
      console.log(`下载的文件: ${files.join(', ')}`);
    }, 30000);

    test('应该能够下载最新版本的包', async () => {
      const config: CliArgs = {
        ...createBaseConfig(),
        name: 'ms', // 小包，下载快
      };

      const app = new App(config);
      await app.downloadMode();

      validateDownloadResult(DOWNLOAD_DIR, ['ms']);
    }, 30000);

    test('应该处理不存在的包名', async () => {
      const config: CliArgs = {
        ...createBaseConfig(),
        name: 'this-package-definitely-does-not-exist-12345',
      };

      const app = new App(config);

      // 应该抛出错误
      await expect(app.downloadMode()).rejects.toThrow();
    }, 30000);
  });

  describe('模式2: 文件列表下载 (--input)', () => {
    test('应该能够从文件列表下载多个包', async () => {
      // 创建包列表文件
      const listFile = path.join(TEMP_FILES_DIR, 'packages.txt');
      const packages = ['lodash@4.17.21', 'ms@2.1.3', 'debug@4.3.4'];
      fs.writeFileSync(listFile, packages.join('\n'));

      const config: CliArgs = {
        ...createBaseConfig(),
        input: listFile,
      };

      const app = new App(config);
      await app.downloadMode();

      // 验证下载结果
      const files = validateDownloadResult(DOWNLOAD_DIR, ['lodash', 'ms', 'debug']);
      console.log(`从列表下载的文件: ${files.join(', ')}`);
    }, 60000);

    test('应该处理空的输入文件', async () => {
      const listFile = path.join(TEMP_FILES_DIR, 'empty.txt');
      fs.writeFileSync(listFile, '');

      const config: CliArgs = {
        ...createBaseConfig(),
        input: listFile,
      };

      const app = new App(config);
      await app.downloadMode();
    }, 30000);
  });

  describe('模式3: package.json下载 (--package)', () => {
    test('应该能够从当前项目的package.json下载依赖', async () => {
      const packageFile = path.join(process.cwd(), 'test', 'resource', 'package.json');
      const config: CliArgs = {
        ...createBaseConfig(),
        package: packageFile, // 使用当前项目的package.json
      };

      const app = new App(config);
      await app.downloadMode();

      // 验证下载结果 - 应该包含项目的依赖包
      const files = validateDownloadResult(DOWNLOAD_DIR, ['lodash']);
      console.log(`从package.json下载的文件数量: ${files.length}`);
    }, 120000); // 增加超时时间，因为依赖较多

    test('应该处理自定义package.json文件', async () => {
      // 创建简单的测试package.json
      const testPackageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
          ms: '^2.1.3',
        },
      };

      const packageFile = path.join(TEMP_FILES_DIR, 'test-package.json');
      fs.writeFileSync(packageFile, JSON.stringify(testPackageJson, null, 2));

      const config: CliArgs = {
        ...createBaseConfig(),
        package: packageFile,
      };

      const app = new App(config);
      await app.downloadMode();

      // 验证下载结果
      validateDownloadResult(DOWNLOAD_DIR, ['lodash', 'ms']);
    }, 60000);
  });

  describe('模式4: 锁文件下载 (--lock)', () => {
    test('应该能够从package-lock.json下载依赖', async () => {
      const lockFile = path.join(process.cwd(), 'test', 'resource', 'package-lock.json');
      const config: CliArgs = {
        ...createBaseConfig(),
        lock: lockFile,
      };

      const app = new App(config);
      await app.downloadMode();

      // 验证下载结果 - 检查是否有文件下载
      expect(fs.existsSync(DOWNLOAD_DIR)).toBe(true);
      const files = fs.readdirSync(DOWNLOAD_DIR);
      console.log(`从package-lock.json下载的文件数量: ${files.length}`);

      // 如果有文件下载，验证格式和内容
      if (files.length > 0) {
        files.forEach((file) => {
          expect(file.endsWith('.tgz')).toBe(true);
        });
        // 如果有文件，应该包含lodash
        expect(files.some((file) => file.includes('lodash'))).toBe(true);
      }
    }, 180000); // 锁文件包含更多依赖，需要更长时间

    test('应该能够从pnpm-lock.yaml下载依赖', async () => {
      const lockFile = path.join(process.cwd(), 'test', 'resource', 'pnpm-lock.yaml');
      const config: CliArgs = {
        ...createBaseConfig(),
        lock: lockFile,
      };

      const app = new App(config);
      await app.downloadMode();

      // 验证下载结果
      const files = validateDownloadResult(DOWNLOAD_DIR);
      console.log(`从pnpm-lock.yaml下载的文件数量: ${files.length}`);

      // 验证包含一些预期的依赖
      expect(files.some((file) => file.includes('lodash'))).toBe(true);
    }, 180000);
  });

  describe('下载功能特性测试', () => {
    test('应该支持自定义输出目录', async () => {
      const customOutput = path.join(TEST_ROOT_DIR, 'custom-output');

      const config: CliArgs = {
        ...createBaseConfig(),
        name: 'ms@2.1.3',
        output: customOutput,
      };

      const app = new App(config);
      await app.downloadMode();

      // 验证自定义输出目录
      validateDownloadResult(customOutput, ['ms']);
    }, 30000);

    test('应该支持并发下载', async () => {
      const packages = ['lodash@4.17.21', 'ms@2.1.3', 'debug@4.3.4'];
      const listFile = path.join(TEMP_FILES_DIR, 'concurrent-packages.txt');
      fs.writeFileSync(listFile, packages.join('\n'));

      const config: CliArgs = {
        ...createBaseConfig(),
        input: listFile,
        threadNumber: 3, // 并发下载
      };

      const startTime = Date.now();
      const app = new App(config);
      await app.downloadMode();
      const endTime = Date.now();

      // 验证下载结果
      validateDownloadResult(DOWNLOAD_DIR, ['lodash', 'ms', 'debug']);

      console.log(`并发下载耗时: ${endTime - startTime}ms`);
    }, 60000);

    test('应该跳过已存在的文件', async () => {
      const config: CliArgs = {
        ...createBaseConfig(),
        name: 'ms@2.1.3',
      };

      const app = new App(config);

      // 首次下载
      await app.downloadMode();
      const firstFiles = fs.readdirSync(DOWNLOAD_DIR);
      const firstFileStats = firstFiles.map((file) => {
        const filePath = path.join(DOWNLOAD_DIR, file);
        return {
          name: file,
          mtime: fs.statSync(filePath).mtime.getTime(),
        };
      });

      // 等待一小段时间确保时间戳不同
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 再次下载相同包
      await app.downloadMode();
      const secondFiles = fs.readdirSync(DOWNLOAD_DIR);

      // 验证文件数量相同
      expect(secondFiles.length).toBe(firstFiles.length);

      // 验证文件没有被重新下载（修改时间应该相同）
      secondFiles.forEach((file) => {
        const filePath = path.join(DOWNLOAD_DIR, file);
        const currentStats = fs.statSync(filePath);
        const originalStats = firstFileStats.find((f) => f.name === file);

        if (originalStats) {
          expect(currentStats.mtime.getTime()).toBe(originalStats.mtime);
        }
      });
    }, 60000);
  });
});
