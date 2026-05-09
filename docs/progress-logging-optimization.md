# 进度条期间日志输出优化方案

## 问题描述

在原始实现中，进度条和错误日志混合显示，导致输出混乱：

```log
Uploading [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% | 0/2293 | ETA: 0s
[16:44:12:910][ERROR] 包上传失败 {"packageName":}
Uploading [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% | 3/2293 | ETA: 536s
[16:44:13:010][ERROR] 包上传失败 {"packageName}
```

## 解决方案

使用 cli-progress 库的 `MultiBar.log()` 方法，在进度条运行期间安全输出日志信息。

### 核心组件

#### 1. 增强版进度条 (`EnhancedProgressBar`)

- 基于 cli-progress 的 MultiBar 实现
- 提供 `log()` 方法在进度条上方输出日志
- 自动处理消息格式化和换行符

```typescript
const progressBar = createEnhancedProgressBar({
  title: 'Uploading',
  total: 100,
  enableLogging: true,
});

progressBar.start();
progressBar.log('这条日志会出现在进度条上方');
progressBar.increment();
progressBar.stop();
```

#### 2. 进度条日志适配器 (`ProgressLogger`)

- 包装原始 Logger 类
- 自动检测进度条状态
- 在进度条运行期间重定向日志到进度条的 log 方法

```typescript
const progressLogger = createProgressLogger(logger);
progressLogger.setProgressBar(progressBar);

// 这些日志会安全地显示在进度条上方
progressLogger.error('包上传失败', { packageName: 'test' });
progressLogger.warn('连接超时，正在重试');

progressLogger.clearProgressBar(); // 恢复正常日志输出
```

### 使用效果

优化后的输出效果：

```log
[16:54:15:155][ERROR] 包上传失败 {"packageName":"ajv","error":"请求格式错误"}
[16:54:15:200][ERROR] 包上传失败 {"packageName":"lodash","error":"网络超时"}
Uploading [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 9% | 220/2293 | ETA: 113s
```

### 集成到包管理器

在 `DefaultPackageManager` 中的集成：

1. **初始化阶段**：创建 `ProgressLogger` 实例
2. **进度条启动**：设置进度条实例到日志适配器
3. **任务执行**：使用 `progressLogger` 替代原始 `logger`
4. **进度条停止**：清除进度条实例，恢复正常日志

```typescript
// 扫描阶段
const scanProgressBar = createEnhancedProgressBar({
  title: 'Scanning',
  total: files.length,
  enableLogging: true,
});
scanProgressBar.start();
this.progressLogger.setProgressBar(scanProgressBar);

// 在任务中使用进度条日志
this.progressLogger.warn(`无法提取包信息: ${filePath}`);

// 完成后清理
scanProgressBar.stop();
this.progressLogger.clearProgressBar();
```

## 技术细节

### cli-progress MultiBar.log() 方法

- **功能**：在多进度条上方输出缓冲内容
- **格式要求**：消息必须以 `\n` 结尾
- **显示效果**：日志出现在进度条上方，不干扰进度条显示
- **兼容性**：支持 ANSI 颜色和格式化

### 自动模式切换

`ProgressLogger` 会自动检测当前状态：

- **进度模式**：进度条运行时，使用 `MultiBar.log()`
- **普通模式**：进度条停止时，使用原始 `Logger`

### 消息格式化

进度条期间的日志消息会被格式化为标准格式：

```
[HH:mm:SS:mmm][LEVEL] 消息内容 {"data":"json"}
```

## 优势

1. **清晰的输出**：日志和进度条分离显示，不再混乱
2. **实时反馈**：错误信息立即显示，无需等待进度条完成
3. **向下兼容**：不影响现有日志功能
4. **自动切换**：无需手动管理日志输出模式
5. **性能优化**：使用 cli-progress 的内置缓冲机制

## 测试验证

运行测试文件验证功能：

```bash
deno run --allow-read --allow-write --allow-net test-progress-logging.ts
```

测试会展示进度条运行期间的日志输出效果，验证日志消息正确显示在进度条上方。