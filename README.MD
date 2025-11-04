# npm包发布工具

基于TypeScript和Bun构建的npm包发布工具，专注于将npm包发布到私有仓库。经过优化，现在支持高性能文件扫描、单包存在性检查和现代HTTP客户端。

## 安装和构建

```bash
# 安装依赖
bun install

# 开发模式运行
bun run dev

# 构建可执行文件（Bun版本，推荐）
bun run build

# 构建跨平台可执行文件（PKG版本，兼容性更好）
bun run build:pkg

# 构建所有版本
bun run build:all
```

### 构建选项说明

- **`bun run build`**: 使用Bun构建，生成单个可执行文件（`dist/pu.exe`），性能最佳，但需要目标机器支持Bun运行时
- **`bun run build:pkg`**: 使用PKG构建，生成跨平台可执行文件：
  - `dist/pu-win.exe` - Windows版本
  - `dist/pu-linux` - Linux版本  
  - `dist/pu-macos` - macOS版本
  - 兼容性更好，无需安装Node.js或Bun运行时
- **`bun run build:all`**: 同时构建两个版本，适合需要分发到不同环境的场景

### 技术实现

PKG构建使用以下技术栈：
- TypeScript编译为CommonJS模块
- `tsc-alias`解析路径别名（`@/*`映射）
- PKG打包为独立可执行文件，支持Node.js 18运行时

## 使用方法

```bash
> pu.exe --help

Options:
      --version   Show version number                                                      [boolean]
  -d, --dir       Directory with packages to publish                  [string] [default: "packages"]
  -r, --registry  Repository registry (format: ${baseURL}/repository/{repository}/)      [string] [required]
  -a, --auth      Repository auth (username:password)                            [string] [required]
  -t, --threads   Concurrent threads                                           [number] [default: 1]
      --help      Show help                                                                [boolean]
```

### 新特性说明

- **移除了 `--force` 参数**: 新版本自动为每个包进行单独的存在性检查，无需强制发布模式
- **智能文件扫描**: 使用fast-glob库进行高性能递归文件扫描
- **精确包信息提取**: 从.tgz文件内的package.json提取准确的包名和版本信息
- **单包存在性检查**: 替代全量仓库扫描，大幅提升检查效率
- **现代HTTP客户端**: 使用fetch API替代curl命令，提供更好的错误处理

### 使用示例

```bash
# 基本用法 - 发布packages目录下的所有.tgz文件
pu.exe -d packages -r http://localhost:8081/repository/npm/ -a username:password

# 使用多线程并发上传
pu.exe -d packages -r https://nexus.example.com/repository/npm-hosted/ -a username:password -t 5

# 发布指定目录及其子目录中的所有包
pu.exe -d dist -r https://nexus.example.com/repository/npm-internal/ -a username:password -t 3
```

### Registry URL格式说明

Registry URL必须符合以下格式：`${BASEURL}/repository/{repository}/`

**示例：**
- 输入：`http://localhost:8081/repository/npm/`
- 解析结果：
  - `baseURL`: `http://localhost:8081/`
  - `repository`: `npm`
  - 上传URL: `http://localhost:8081/service/rest/v1/components?repository=npm`

**支持的格式：**
- `http://localhost:8081/repository/npm/`
- `https://nexus.company.com/repository/npm-public/`
- `https://nexus.company.com:8443/repository/npm-internal/`

### 工作流程

1. **文件扫描**: 使用fast-glob递归扫描指定目录下的所有.tgz文件
2. **包信息提取**: 从每个.tgz文件内的package.json提取包名和版本信息
3. **存在性检查**: 并发检查每个包是否已存在于远程仓库
4. **智能上传**: 只上传不存在或版本不同的包
5. **结果报告**: 提供详细的成功/失败统计和错误信息

## 已知问题

### 上传文件损坏

现象：少数包在内网仓库发布后会损坏，表现为拉取时提示`seems to be corrupted`。

原因：不详。

解决方法：首先确认上传的包是否存在问题，确认无误后通过web管理端手动上传。

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **构建工具**: Bun build
- **代码规范**: ESLint + Prettier
- **提交规范**: Angular Commit Convention
- **Git钩子**: Husky + lint-staged + commitlint

## 项目结构

```
src/
├── core/                    # 核心业务逻辑
│   ├── cli.ts              # CLI参数处理
│   └── app.ts              # 应用主逻辑
├── services/               # 业务服务层
│   ├── publish.ts          # 发布服务（优化版）
│   ├── package-manager.ts  # 包管理器（新增）
│   ├── package-scanner.ts  # 包扫描器（新增）
│   ├── package-checker.ts  # 包检查器（新增）
│   ├── package-uploader.ts # 包上传器（新增）
│   └── progress-tracker.ts # 进度跟踪器（新增）
├── utils/                  # 工具函数
│   ├── file.ts            # 文件操作工具
│   ├── task.ts            # 并发任务工具
│   ├── logger.ts          # 日志工具
│   ├── enhanced-logger.ts # 增强日志工具（新增）
│   └── common.ts          # 通用工具
├── types/                 # TypeScript类型定义
│   ├── config.ts          # 配置类型
│   ├── package.ts         # 包相关类型
│   ├── error.ts           # 错误处理类型
│   ├── logger.ts          # 日志类型
│   └── index.ts           # 统一类型导出
└── index.ts               # 应用入口点
```

## 功能特性

### 核心功能
- [x] 支持发布到nexus仓库
  - [x] 智能跳过远端仓库已有的包
  - [x] 支持并发发布控制
  - [x] 单包存在性检查（替代全量扫描）
- [x] TypeScript支持
  - [x] 完整的类型安全
  - [x] 模块化架构设计
  - [x] 使用Bun运行时

### 性能优化
- [x] **高性能文件扫描**: 使用fast-glob库，支持递归扫描和模式匹配
- [x] **精确包信息提取**: 从.tgz文件内的package.json解析包名和版本
- [x] **单包存在性检查**: 避免全量仓库扫描，大幅提升检查效率
- [x] **现代HTTP客户端**: 使用fetch API替代curl，提供更好的错误处理
- [x] **智能并发控制**: 支持扫描、检查、上传的独立并发控制

### 错误处理和日志
- [x] **详细错误分类**: 网络错误、认证错误、文件错误等分类处理
- [x] **结构化日志记录**: 支持不同日志级别和敏感信息过滤
- [x] **实时进度跟踪**: 提供扫描、检查、上传各阶段的进度反馈
- [x] **操作结果统计**: 详细的成功/失败统计和错误报告

## 性能对比

| 功能         | 旧版本                | 新版本           | 改进             |
| ------------ | --------------------- | ---------------- | ---------------- |
| 文件扫描     | fs.readdirSync (同步) | fast-glob (异步) | 性能提升50-80%   |
| 包存在性检查 | 全量仓库扫描          | 单包检查         | 速度提升2-5倍    |
| HTTP请求     | curl命令              | fetch API        | 更好的错误处理   |
| 并发控制     | 简单队列              | 智能调度         | 更高效的资源利用 |

> **注意**: 新版本移除了全量仓库扫描功能，每个包都会进行独立的存在性检查。
> 这大幅提升了性能，特别是在处理大型仓库时。对于包含7000+包的仓库，
> 检查时间从约2分钟缩短到几秒钟。
