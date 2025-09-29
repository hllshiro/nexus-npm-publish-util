# npm包迁移工具

## 使用方法

```bash
> lpm.exe --help

Options:
      --version           Show version number                                              [boolean]
  -n, --name              Package name to download                                          [string]
  -i, --input             File with package names                                           [string]
      --package           Path to package.json                                              [string]
      --lock              Parse package-lock.json or pnpm-lock.yaml (highest priority)      [string]
      --registry          Override registry URL                                             [string]
      --force             Add --force to npm install                      [boolean] [default: false]
      --legacy-peer-deps  Add --legacy-peer-deps to npm install           [boolean] [default: false]
  -o, --output            Download save path                          [string] [default: "download"]
  -p, --publish           Enable publish mode (highest priority)          [boolean] [default: false]
      --publish-dir       Directory with packages to publish          [string] [default: "download"]
      --publish-url       Repository publish URL                                            [string]
      --publish-auth      Repository auth (username:password)                               [string]
      --force-publish     Force publish all packages                      [boolean] [default: false]
      --thread-number     Concurrent threads for download/publish              [number] [default: 1]
      --help              Show help                                                        [boolean]
```

## 已知问题

### 校验错误

现象：在外网下载包时，即使下载的包正确，仍有小部分包会校验错。

原因：package-lock.json文件中的校验码与实际文件不一致，无法确认导致这一现象的根本原因。另外使用一些镜像库时也可能出现校验码不一致的问题。

解决方法：手动确认下载的包是否完整（能解压），然后忽略这个问题。

### 上传文件损坏

现象：少数包在内网仓库发布后会损坏，表现为拉取时提示`seems to be corrupted`。

原因：不详。

解决方法：首先确认上传的包是否存在问题，确认无误后通过web管理端手动上传。

### 外网正常，内网依赖冲突

现象：外网通过package.json文件拉取包时不报错，迁移到内网拉取就报依赖冲突。

原因：可能与npm解析依赖树机制有关，具体不详。

解决方法：把外网生成的lock文件拷贝到项目下，提交。

## 开发计划

- [x] 支持下载依赖
  - [x] 从命令传入包名
  - [x] 从文件传入包名
  - [x] 解析package.json文件或pnpm-lock.yaml文件
  - [x] 解析package-lock.json文件，支持lockfileVersion: 2和lockfileVersion: 3
  - [x] 下载时跳过已存在的包
  - [x] 下载结果校验
- [x] 支持发布到nexus仓库
  - [x] 发布时跳过远端仓库已有的包
- [x] 优化
  - [x] 修改下载和上传的Promise.all，实现并发控制

> 远程仓库已有包扫描效率很低，仓库中7000+包时，耗时约2分钟。
> 主要受限于网络条件和nexus的API设计，每次调用只能获取10个，需要循环多次才能获取全部数据。
> 建议需要发布的包数量较少时，且新包居多时，直接强制发布。
