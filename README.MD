# npm包迁移工具

## 使用方法

```bash
Options:
      --version           Show version number                                                  [boolean]
  -n, --name              待下载的包名                                                          [string]
  -i, --input             包含包名的文件路径                                                    [string]
      --package           待解析的package.json文件路径                                          [string]
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
