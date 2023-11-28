# npm包迁移工具

## 前置条件

1. `nodejs`版本需要内外网保持一致(版本兼容问题)
2. 安装依赖`log4js`和`axios`

## 使用方法

### 下载指定包

1. 修改`main.js`中的`target`参数为包名，包名需要符合npm规范
2. 执行 `node main.js`

### 解析`package.json`并下载

1. 修改`main.js`中的`target`参数为空字符串''
2. 拷贝当前的`package.json`依赖到需要下载的`package.json`，主要是`axios`和`log4js`
3. 将`package.json`放在当前目录下
4. 执行 `node main.js`

### 解析`package-lock.json`并下载

1. 将`package-lock.json`放在当前目录下
2. 执行 `node download.js`

### 上传到私服

1. 手动修改所有esbuild包
   - 用压缩包打开esbuild包，修改包内的install.js文件
      - 全局替换 https => http
      - 替换请求地址 registry.npmjs.org =>nexus.senjone.com/repository/npm-hosted
2. 在内网执行`node publish.js`

## 其他问题

1. 执行publish，目标仓库中已有的包会自动忽略