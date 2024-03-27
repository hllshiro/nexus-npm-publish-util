# npm包迁移工具

## 使用方法

```bash
Options:
      --version           Show version number                                                  [boolean]
  -n, --name              待下载的包名                                                          [string]
  -i, --input             包含包名的文件路径                                                    [string]
      --package           待解析的package.json文件路径                                          [string]
      --lock              直接解析package-lock.json文件，优先级最高                             [string]
      --registry          覆盖默认registry配置，用于包解析                                      [string]
      --force             调用"npm install"时追加--force参数                  [boolean] [default: false]
      --legacy-peer-deps  调用"npm install"时追加--legacy-peer-deps参数       [boolean] [default: false]
  -o, --output            下载文件保存路径                                [string] [default: "download"]
  -p, --publish           发布模式，优先级高于下载参数                        [boolean] [default: false]
      --publish-dir       包含待发布包的目录路径                          [string] [default: "download"]
      --publish-url       远程仓库发布地址                                                      [string]
      --publish-auth      远程仓库认证信息，例如[用户名:密码]                                   [string]
      --force-publish     强制发布所有的包，默认跳过远程仓库已存在的包        [boolean] [default: false]
      --help              Show help                                                            [boolean]
```

## 已知问题

### 校验错误

现象：在外网下载包时，即使下载的包正确，仍有小部分包会校验错。

原因：package-lock.json文件中的校验码与实际文件不一致，无法确认导致这一现象的根本原因。

解决方法：手动确认下载的包是否完整（能解压），然后忽略这个问题。

### 上传文件损坏

现象：少数包在内网仓库发布后会损坏，表现为拉取时提示`seems to be corrupted`。

原因：不详。

解决方法：首先确认上传的包是否存在问题，确认无误后通过web管理端手动上传。

### 外网正常，内网依赖冲突

现象：外网通过package.json文件拉取包时不报错，迁移到内网拉取就报依赖冲突。

原因：可能与npm解析依赖树机制有关，具体不详。

解决方法：把外网生成的lock文件拷贝到项目下，提交。
