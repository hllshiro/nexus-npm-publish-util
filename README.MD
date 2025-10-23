# npm包发布工具

基于TypeScript和Bun构建的npm包发布工具，专注于将npm包发布到私有仓库。

## 安装和构建

```bash
# 安装依赖
bun install

# 开发模式运行
bun run dev

# 构建可执行文件
bun run build

# 验证构建
bun run verify
```

## 使用方法

```bash
> pu.exe --help

Options:
      --version  Show version number                                                       [boolean]
  -d, --dir      Directory with packages to publish                   [string] [default: "packages"]
  -u, --url      Repository URL                                                  [string] [required]
  -a, --auth     Repository auth (username:password)                             [string] [required]
  -f, --force    Force publish all packages                               [boolean] [default: false]
  -t, --threads  Concurrent threads                                            [number] [default: 1]
      --help     Show help                                                                 [boolean]
```

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
├── core/           # 核心业务逻辑
│   ├── cli.ts      # CLI参数处理
│   └── app.ts      # 应用主逻辑
├── services/       # 业务服务层
│   └── publish.ts  # 发布服务
├── utils/          # 工具函数
│   ├── file.ts     # 文件操作工具
│   ├── task.ts     # 并发任务工具
│   ├── logger.ts   # 日志工具
│   └── common.ts   # 通用工具
├── types/          # TypeScript类型定义
│   └── index.ts    # 统一类型导出
└── index.ts        # 应用入口点
```

## 功能特性

- [x] 支持发布到nexus仓库
  - [x] 发布时跳过远端仓库已有的包
  - [x] 支持并发发布控制
  - [x] 强制发布模式
- [x] TypeScript支持
  - [x] 完整的类型安全
  - [x] 模块化架构设计
  - [x] 使用Bun运行时

> 远程仓库已有包扫描效率很低，仓库中7000+包时，耗时约2分钟。
> 主要受限于网络条件和nexus的API设计，每次调用只能获取10个，需要循环多次才能获取全部数据。
> 建议需要发布的包数量较少时，且新包居多时，直接强制发布。
