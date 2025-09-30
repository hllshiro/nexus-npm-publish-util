#!/usr/bin/env bun

/**
 * 测试运行脚本
 * 用于运行download模式的所有测试，并确保测试结束后清理.test目录
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const testFile = path.join(__dirname, 'download.test.ts');
const testDir = path.join(process.cwd(), '.test');

// 清理.test目录的函数
function cleanupTestDir() {
  if (fs.existsSync(testDir)) {
    console.log('🧹 清理测试目录:', testDir);
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('✨ 测试目录清理完成');
  }
}

// 确保程序退出时清理测试目录
process.on('exit', cleanupTestDir);
process.on('SIGINT', () => {
  cleanupTestDir();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupTestDir();
  process.exit(0);
});

console.log('🚀 开始运行 Download 模式测试...\n');

// 在Windows下需要使用.cmd扩展名或shell模式
const bunCommand = process.platform === 'win32' ? 'bun.cmd' : 'bun';

const testProcess = spawn(bunCommand, ['test', testFile, '--verbose'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  shell: process.platform === 'win32', // 在Windows下使用shell
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ 所有测试通过！');
  } else {
    console.log('\n❌ 测试失败，退出码:', code);
  }

  // 测试结束后清理
  cleanupTestDir();
  process.exit(code);
});

testProcess.on('error', (error) => {
  console.error('❌ 运行测试时出错:', error);
  cleanupTestDir();
  process.exit(1);
});
