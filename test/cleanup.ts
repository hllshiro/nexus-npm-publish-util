#!/usr/bin/env bun

/**
 * 清理测试目录脚本
 * 手动清理 .test 目录
 */

import fs from 'fs';
import path from 'path';

const testDir = path.join(process.cwd(), '.test');

function cleanupTestDir() {
  if (fs.existsSync(testDir)) {
    console.log('🧹 清理测试目录:', testDir);
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('✨ 测试目录清理完成');
  } else {
    console.log('📁 测试目录不存在，无需清理');
  }
}

cleanupTestDir();
