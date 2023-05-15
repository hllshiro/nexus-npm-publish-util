# npm包迁移工具

## 前置条件

1. `nodejs`版本需要内外网保持一致(版本兼容问题)
2. 安装`shelljs`依赖

## 使用方法

### 下载指定包

1. 修改`downloadWithPackage.js`中的`target`参数为包名，包名需要符合npm规范
2. 在公网执行 `node downloadWithPackage.js`

### 解析`package.json`并下载

1. 修改`downloadWithPackage.js`中的`target`参数为空字符串''
2. 将`package.json`放在当前目录下
3. 在公网执行 `node downloadWithPackage.js`

### 解析`package-lock.json`并下载

1. 将`package-lock.json`放在当前目录下
2. 在公网执行 `node downloadWithLock.js`

### 上传到私服

1. 手动修改所有esbuild包
   - 用压缩包打开esbuild包，修改包内的install.js文件
      - 全局替换 https => http
      - 替换请求地址 registry.npmjs.org =>nexus.senjone.com/repository/npm-hosted
2. 在内网执行`node publish.js`

## 其他问题

1. 执行download时，`downloadedDir`路径下的包不会重复下载
2. 执行publish，目标仓库中已有的包会自动忽略