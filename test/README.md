# Download 模式测试

本目录包含了对 lpm 工具 download 模式的全面测试。

## 测试覆盖范围

### 四种下载模式测试

1. **包名下载 (--name)**
   - 单个包下载
   - 指定版本下载
   - 不存在包的错误处理

2. **文件列表下载 (--input)**
   - 从文件读取包列表
   - 多个包批量下载
   - 空文件处理

3. **package.json 下载 (--package)**
   - 从当前项目 package.json 下载依赖
   - 自定义 package.json 文件
   - 依赖解析和下载

4. **锁文件下载 (--lock)**
   - package-lock.json 解析和下载
   - pnpm-lock.yaml 转换和下载
   - 锁文件版本兼容性

### 功能特性测试

- 自定义输出目录
- 并发下载控制
- 文件完整性校验
- 跳过已存在文件
- 错误处理和恢复

## 测试资源

- `package-lock.json` - 项目的 npm 锁文件
- `pnpm-lock.yaml` - 项目的 pnpm 锁文件
- `download.test.ts` - 主要测试文件
- `run-tests.ts` - 测试运行脚本（自动清理）
- `cleanup.ts` - 手动清理脚本
- `sample-packages.txt` - 示例包列表文件

## 测试目录结构

```
.test/                    # 测试根目录（已加入.gitignore）
├── download/            # 下载文件存放目录
├── temp/               # 临时文件目录
└── custom-output/      # 自定义输出目录测试
```

## 运行测试

### 方式一：推荐使用测试脚本（自动清理）

```bash
# 运行测试脚本（推荐，会自动清理.test目录）
bun run test

# 或者直接运行脚本
bun run test/run-tests.ts
```

### 方式二：直接运行测试（需要手动清理）

```bash
# 直接运行测试
bun run test:direct

# 运行特定测试组
bun test test/download.test.ts --grep "模式1"

# 详细输出
bun run test:verbose

# 监听模式
bun run test:watch
```

### 方式三：手动清理

```bash
# 手动清理测试目录
bun run test:cleanup
```

## 测试说明

### 超时设置

不同测试有不同的超时时间：
- 单包下载：30秒
- 多包下载：60秒
- package.json 下载：120秒
- 锁文件下载：180秒

### 网络依赖

测试需要网络连接来下载真实的 npm 包。如果网络不稳定，可能需要：
1. 增加超时时间
2. 使用本地 npm 镜像
3. 跳过网络相关测试

### 清理机制

测试会自动清理：
- 测试根目录 (`.test/`)
- 下载目录 (`.test/download`)
- 临时测试文件 (`.test/temp`)
- 所有测试产生的临时文件

所有测试相关的临时文件都统一存放在项目根目录的 `.test` 目录下，该目录已添加到 `.gitignore` 中。

### 验证逻辑

每个测试都会验证：
1. 下载目录是否创建
2. 文件是否下载成功
3. 文件格式是否正确 (.tgz)
4. 预期的包是否存在
5. 文件完整性

## 故障排除

### 常见问题

1. **网络超时**
   - 检查网络连接
   - 尝试使用国内镜像：`npm config set registry https://registry.npmmirror.com`

2. **权限错误**
   - 确保有写入 test 目录的权限
   - 检查防病毒软件是否阻止文件操作

3. **依赖缺失**
   - 运行 `bun install` 安装项目依赖
   - 确保 TypeScript 类型正确

4. **测试失败**
   - 查看详细错误信息
   - 检查下载的文件是否完整
   - 验证网络连接和 npm registry 可访问性

### 调试技巧

1. 使用 `--verbose` 参数查看详细输出
2. 在测试中添加 `console.log` 输出中间状态
3. 检查 `.test/download` 目录中的实际文件
4. 使用 `--grep` 参数运行特定测试

## 扩展测试

如需添加新的测试用例：

1. 在 `download.test.ts` 中添加新的 `test()` 或 `describe()` 块
2. 使用现有的辅助函数 `createBaseConfig()` 和 `validateDownloadResult()`
3. 确保清理测试产生的临时文件
4. 设置合适的超时时间

## 性能基准

测试还可以用作性能基准：
- 单包下载时间
- 并发下载效率
- 大量依赖处理能力
- 内存使用情况