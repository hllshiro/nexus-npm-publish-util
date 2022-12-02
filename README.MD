# npm包迁移工具

## 前置条件

1. `nodejs`版本需要内外网保持一致(不确定)
2. 安装`shelljs`和`json5`依赖，不要安装到全局，不生效

## 使用方法

### 下载指定包

1. 修改`downloadWithPackage.js`中的`target`参数为包名
2. 在公网执行 `node downloadWithPackage.js`

### 解析`package.json`并下载

1. 修改`downloadWithPackage.js`中的`target`参数为空字符串''
2. 将`package.json`放在同级目录下，可以替换shelljs继而json5依赖的package文件
3. 在公网执行 `node downloadWithPackage.js`

### 解析`package-lock.json`并下载

1. 将`package-lock.json`放在同级目录下，可以替换shelljs继而json5依赖的package文件
2. 在公网执行 `node downloadWithLock.js`

### 上传到私服

1. 手动修改所有esbuild包
   1. 用压缩包打开esbuild包，修改包内的install.js文件
      - 全局替换 https => http
      - 替换请求地址 registry.npmjs.org =>nexus.senjone.com/repository/npm-hosted
2. 在内网执行`node publish.js`

## 其他问题

1. 执行download时，./download/downloaded中的包不会重复下载
2. 执行publish，重复的包会被忽略