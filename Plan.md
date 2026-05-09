# 重构修复计划

## 阶段一：关键缺陷修复

### 1.1 入口 Promise 未 await
- **文件**: `src/index.ts:46`
- **问题**: `new App(cliArgs).run()` 返回 Promise 未 await，异常处理链断裂
- **方案**: 改为 `try { await new App(cliArgs).run() } catch { process.exit(1) }`

### 1.2 PackageChecker 缺少认证头
- **文件**: `src/services/package-checker.ts`, `src/types/index.ts`
- **问题**: fetchWithTimeout 未携带 Authorization，私有仓库检查永远 401
- **方案**:
  - `PackageCheckerConfig` 增加 `auth?: string`
  - `RegistryPackageChecker` 构造函数接收 auth
  - `fetchWithTimeout` 添加 Authorization header
  - `DefaultPackageManager` 构造 checker 时传入 `config.publishAuth`

### 1.3 connectTimeout 未生效
- **文件**: `src/types/index.ts`, `src/core/app.ts`, `src/services/package-checker.ts`, `src/services/package-uploader.ts`
- **问题**: connectTimeout 和 requestTimeout 共用一个 AbortController
- **方案**: 移除 connectTimeout 字段，只保留 requestTimeout（fetch API 无法区分连接/请求超时）

## 阶段二：死代码清理

### 2.1 删除 `src/services/publish.ts`
- 未被任何文件导入，App 直接使用 createPackageManager()

### 2.2 删除 `src/services/upload-progress-tracker.ts`
- 与 GeneralProgressTracker 功能重叠，未被使用

### 2.3 清理未使用的方法
- `package-scanner.ts`: 删除 `validateDirectory()`, `getScanStats()`
- `package-info-extractor.ts`: 删除 `extractMultiplePackageInfo()`, `validatePackageInfo()`, `chunkArray()`

### 2.4 删除 types 中未使用的接口
- 移除 `UploadProgressTracker` 相关的未使用类型（如果有）

## 阶段三：功能集成

### 3.1 新建重试工具 `src/utils/retry.ts`
- 实现 `withRetry<T>(fn, config)` 函数
- 支持 maxAttempts, baseDelay, maxDelay, retryableCheck
- 指数退避 + 抖动

### 3.2 集成 ErrorHandler / ErrorClassifier
- `package-manager.ts`: 使用 ErrorHandler.logError() + ErrorClassifier.isRetryable()
- `package-checker.ts`: 使用 ErrorHandler.createPackageCheckError() 替代本地方法
- `package-uploader.ts`: 使用 ErrorHandler.createPackageUploadError() 替代本地方法
- 删除 checker 和 uploader 中重复的错误创建方法

### 3.3 集成重试机制
- `package-checker.ts`: checkPackageExists 内层使用 withRetry
- `package-uploader.ts`: executeUploadRequest 内层使用 withRetry
- 使用 ErrorClassifier.isRetryable() 判断是否重试

### 3.4 集成 TaskFileTracker
- `DefaultPackageManager` 构造函数接受可选 `taskFilePath?: string`
- publishPackages 流程中初始化、过滤、标记、保存
- CLI (`cli.ts`) 增加可选参数 `--task-file` / `-f`
- `types/index.ts` 的 CliArgs 增加 `taskFilePath?: string`

## 阶段四：测试补充

### 4.1 修复测试配置
- `deno.json` test.include 增加 `src/**/*.test.ts` 模式

### 4.2 补充单元测试
- `src/utils/registry-url-parser.test.ts`
- `src/utils/retry.test.ts`
- `src/utils/error-handler.test.ts`

### 4.3 补充集成测试
- `src/services/package-manager.test.ts` (mock 依赖)

## 执行顺序

```
阶段一 + 阶段二（可并行）
       ↓
阶段三（依赖阶段一的认证修复）
       ↓
阶段四（依赖阶段三的最终形态）
```
