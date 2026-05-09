import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { DefaultTaskFileTracker, generatePackageKey } from './task-file-tracker.ts';

/**
 * 测试任务文件读取功能
 */
Deno.test('任务2.1: 从指定路径加载JSON格式的任务文件', async () => {
  const tracker = new DefaultTaskFileTracker();
  const testFilePath = './test-task-file.json';

  // 创建测试任务文件
  const testData = {
    version: '1.0.0',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    processedPackages: ['test-package@1.0.0', 'another-package@2.0.0'],
  };

  await Deno.writeTextFile(testFilePath, JSON.stringify(testData, null, 2));

  try {
    // 初始化并加载任务文件
    await tracker.initialize(testFilePath);

    // 验证已处理包数量
    assertEquals(tracker.getProcessedCount(), 2);

    // 验证包是否被正确识别为已处理
    assertEquals(tracker.isProcessed('test-package@1.0.0'), true);
    assertEquals(tracker.isProcessed('another-package@2.0.0'), true);
    assertEquals(tracker.isProcessed('new-package@1.0.0'), false);
  } finally {
    // 清理测试文件
    try {
      await Deno.remove(testFilePath);
    } catch {
      // 忽略删除错误
    }
  }
});

Deno.test('任务2.1: 处理文件不存在的情况，返回空的已处理列表', async () => {
  const tracker = new DefaultTaskFileTracker();
  const nonExistentPath = './non-existent-task-file.json';

  // 初始化不存在的任务文件
  await tracker.initialize(nonExistentPath);

  // 验证返回空列表
  assertEquals(tracker.getProcessedCount(), 0);
  assertEquals(tracker.isProcessed('any-package@1.0.0'), false);
});

Deno.test('任务2.1: 解析并验证任务文件格式和版本兼容性', async () => {
  const tracker = new DefaultTaskFileTracker();
  const testFilePath = './test-invalid-task-file.json';

  // 创建格式无效的任务文件
  const invalidData = {
    version: '1.0.0',
    // 缺少必需字段
    processedPackages: ['test@1.0.0'],
  };

  await Deno.writeTextFile(testFilePath, JSON.stringify(invalidData, null, 2));

  try {
    // 初始化应该处理格式错误
    await tracker.initialize(testFilePath);

    // 验证降级到空列表
    assertEquals(tracker.getProcessedCount(), 0);

    // 验证备份文件是否创建
    const backupExists = await Deno.stat(`${testFilePath}.backup`).then(() => true).catch(() => false);
    assertExists(backupExists);
  } finally {
    // 清理测试文件
    try {
      await Deno.remove(testFilePath);
      await Deno.remove(`${testFilePath}.backup`);
    } catch {
      // 忽略删除错误
    }
  }
});

Deno.test('任务2.1: 处理JSON解析错误', async () => {
  const tracker = new DefaultTaskFileTracker();
  const testFilePath = './test-malformed-task-file.json';

  // 创建格式错误的JSON文件
  await Deno.writeTextFile(testFilePath, '{ invalid json content }');

  try {
    // 初始化应该处理JSON解析错误
    await tracker.initialize(testFilePath);

    // 验证降级到空列表
    assertEquals(tracker.getProcessedCount(), 0);
  } finally {
    // 清理测试文件
    try {
      await Deno.remove(testFilePath);
      await Deno.remove(`${testFilePath}.backup`);
    } catch {
      // 忽略删除错误
    }
  }
});

Deno.test('generatePackageKey: 生成正确的包唯一标识', () => {
  const key = generatePackageKey('my-package', '1.0.0');
  assertEquals(key, 'my-package@1.0.0');
});

Deno.test('packageCache: 缓存读写正常', async () => {
  const tracker = new DefaultTaskFileTracker();
  const testFilePath = './test-cache-task-file.json';

  const testData = {
    version: '1.0.0',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    processedPackages: ['pkg@1.0.0'],
    packageCache: {
      '/path/to/pkg-1.0.0.tgz': {
        filePath: '/path/to/pkg-1.0.0.tgz',
        fileName: 'pkg-1.0.0.tgz',
        packageName: 'pkg',
        version: '1.0.0',
      },
    },
  };

  await Deno.writeTextFile(testFilePath, JSON.stringify(testData, null, 2));

  try {
    await tracker.initialize(testFilePath);

    // 验证缓存读取
    const cached = tracker.getCachedPackageInfo('/path/to/pkg-1.0.0.tgz');
    assertExists(cached);
    assertEquals(cached.packageName, 'pkg');
    assertEquals(cached.version, '1.0.0');

    // 不存在的路径返回 null
    assertEquals(tracker.getCachedPackageInfo('/nonexistent'), null);
  } finally {
    try {
      await Deno.remove(testFilePath);
    } catch {
      // ignore
    }
  }
});

Deno.test('packageCache: 写入缓存后保存到文件', async () => {
  const tracker = new DefaultTaskFileTracker();
  const testFilePath = './test-cache-save-task-file.json';

  try {
    await tracker.initialize(testFilePath);

    // 写入缓存
    tracker.setCachedPackageInfo('/path/to/new-pkg-2.0.0.tgz', {
      filePath: '/path/to/new-pkg-2.0.0.tgz',
      fileName: 'new-pkg-2.0.0.tgz',
      packageName: 'new-pkg',
      version: '2.0.0',
    });
    tracker.markAsProcessed('new-pkg@2.0.0');
    await tracker.save();

    // 重新加载验证
    const tracker2 = new DefaultTaskFileTracker();
    await tracker2.initialize(testFilePath);

    const cached = tracker2.getCachedPackageInfo('/path/to/new-pkg-2.0.0.tgz');
    assertExists(cached);
    assertEquals(cached.packageName, 'new-pkg');
    assertEquals(tracker2.isProcessed('new-pkg@2.0.0'), true);
  } finally {
    try {
      await Deno.remove(testFilePath);
    } catch {
      // ignore
    }
  }
});

Deno.test('packageCache: 兼容旧版本（无packageCache字段）', async () => {
  const tracker = new DefaultTaskFileTracker();
  const testFilePath = './test-old-format-task-file.json';

  // 旧版本格式，没有 packageCache 字段
  const oldData = {
    version: '1.0.0',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    processedPackages: ['old-pkg@1.0.0'],
  };

  await Deno.writeTextFile(testFilePath, JSON.stringify(oldData, null, 2));

  try {
    await tracker.initialize(testFilePath);

    // 旧数据正常加载
    assertEquals(tracker.getProcessedCount(), 1);
    assertEquals(tracker.isProcessed('old-pkg@1.0.0'), true);

    // 缓存为空但不报错
    assertEquals(tracker.getCachedPackageInfo('/any/path'), null);

    // 写入新缓存后保存，旧数据不丢失
    tracker.setCachedPackageInfo('/path/new.tgz', {
      filePath: '/path/new.tgz',
      fileName: 'new.tgz',
      packageName: 'new',
      version: '1.0.0',
    });
    await tracker.save();

    // 重新加载验证
    const tracker2 = new DefaultTaskFileTracker();
    await tracker2.initialize(testFilePath);
    assertEquals(tracker2.isProcessed('old-pkg@1.0.0'), true);
    assertExists(tracker2.getCachedPackageInfo('/path/new.tgz'));
  } finally {
    try {
      await Deno.remove(testFilePath);
    } catch {
      // ignore
    }
  }
});
