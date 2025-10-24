#!/usr/bin/env bun

/**
 * 集成测试运行脚本
 * 用于执行端到端集成测试和性能基准测试
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

interface TestSuite {
  name: string;
  path: string;
  timeout: number;
  description: string;
}

const TEST_SUITES: TestSuite[] = [
  {
    name: '端到端集成测试',
    path: 'src/__tests__/integration/end-to-end.test.ts',
    timeout: 120000, // 2分钟
    description: '测试完整的扫描→检查→上传流程，验证并发控制和错误处理',
  },
  {
    name: '性能基准测试',
    path: 'src/__tests__/performance/benchmark.test.ts',
    timeout: 300000, // 5分钟
    description: '对比新旧实现的性能差异，测试不同并发数下的性能表现',
  },
];

/**
 * 运行单个测试套件
 */
async function runTestSuite(suite: TestSuite): Promise<boolean> {
  console.log(`\n🧪 开始运行: ${suite.name}`);
  console.log(`📝 描述: ${suite.description}`);
  console.log(`📁 路径: ${suite.path}`);
  console.log(`⏱️  超时: ${suite.timeout / 1000}秒`);
  console.log('─'.repeat(80));

  // 检查测试文件是否存在
  if (!existsSync(suite.path)) {
    console.error(`❌ 测试文件不存在: ${suite.path}`);
    return false;
  }

  return new Promise((resolve) => {
    const startTime = Date.now();

    // 运行测试
    const testProcess = spawn('bun', ['test', suite.path, '--timeout', suite.timeout.toString()], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    testProcess.on('close', (code) => {
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      if (code === 0) {
        console.log(`✅ ${suite.name} 完成 (耗时: ${duration}秒)`);
        resolve(true);
      } else {
        console.log(`❌ ${suite.name} 失败 (耗时: ${duration}秒, 退出码: ${code})`);
        resolve(false);
      }
    });

    testProcess.on('error', (error) => {
      console.error(`❌ ${suite.name} 执行错误:`, error.message);
      resolve(false);
    });
  });
}

/**
 * 运行所有测试套件
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 开始运行集成测试和性能基准测试');
  console.log('═'.repeat(80));

  const results: { suite: TestSuite; success: boolean }[] = [];
  const overallStartTime = Date.now();

  for (const suite of TEST_SUITES) {
    const success = await runTestSuite(suite);
    results.push({ suite, success });
  }

  const overallEndTime = Date.now();
  const totalDuration = ((overallEndTime - overallStartTime) / 1000).toFixed(2);

  // 输出总结报告
  console.log('\n' + '═'.repeat(80));
  console.log('📊 测试执行总结');
  console.log('═'.repeat(80));

  let successCount = 0;
  let failureCount = 0;

  results.forEach(({ suite, success }) => {
    const status = success ? '✅ 通过' : '❌ 失败';
    console.log(`${status} ${suite.name}`);

    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  });

  console.log('─'.repeat(80));
  console.log(`📈 总计: ${results.length} 个测试套件`);
  console.log(`✅ 通过: ${successCount} 个`);
  console.log(`❌ 失败: ${failureCount} 个`);
  console.log(`⏱️  总耗时: ${totalDuration}秒`);

  if (failureCount > 0) {
    console.log('\n⚠️  存在失败的测试套件，请检查上述输出');
    process.exit(1);
  } else {
    console.log('\n🎉 所有测试套件都已通过！');
    process.exit(0);
  }
}

/**
 * 运行特定测试套件
 */
async function runSpecificTest(testName: string): Promise<void> {
  const suite = TEST_SUITES.find(
    (s) =>
      s.name.toLowerCase().includes(testName.toLowerCase()) || s.path.toLowerCase().includes(testName.toLowerCase())
  );

  if (!suite) {
    console.error(`❌ 未找到匹配的测试套件: ${testName}`);
    console.log('\n可用的测试套件:');
    TEST_SUITES.forEach((s) => {
      console.log(`  - ${s.name} (${s.path})`);
    });
    process.exit(1);
  }

  console.log('🚀 运行特定测试套件');
  console.log('═'.repeat(80));

  const success = await runTestSuite(suite);

  if (success) {
    console.log('\n🎉 测试套件执行成功！');
    process.exit(0);
  } else {
    console.log('\n❌ 测试套件执行失败！');
    process.exit(1);
  }
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log('🧪 集成测试运行脚本');
  console.log('═'.repeat(50));
  console.log('');
  console.log('用法:');
  console.log('  bun run scripts/run-integration-tests.ts [选项]');
  console.log('');
  console.log('选项:');
  console.log('  --help, -h     显示帮助信息');
  console.log('  --all          运行所有测试套件 (默认)');
  console.log('  --test <name>  运行特定测试套件');
  console.log('');
  console.log('可用的测试套件:');
  TEST_SUITES.forEach((suite) => {
    console.log(`  - ${suite.name}`);
    console.log(`    路径: ${suite.path}`);
    console.log(`    描述: ${suite.description}`);
    console.log('');
  });
  console.log('示例:');
  console.log('  bun run scripts/run-integration-tests.ts');
  console.log('  bun run scripts/run-integration-tests.ts --test integration');
  console.log('  bun run scripts/run-integration-tests.ts --test performance');
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const testIndex = args.indexOf('--test');
  if (testIndex !== -1 && testIndex + 1 < args.length) {
    const testName = args[testIndex + 1];
    await runSpecificTest(testName);
    return;
  }

  // 默认运行所有测试
  await runAllTests();
}

// 运行主函数
main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
