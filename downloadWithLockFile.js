/**
 * 解析当前文件夹下package-lock.json文件的依赖，将dependencies和packages中涉及到的依赖全部下载
 * 请确保路径 ./download 和 ./download/downloaded 存在
 */

// 每次下载的文件会放在download里，publish到仓库后，可以手动移动到download/downloaded里，方便下次避免重复下载
const downloadDir = "./download";
const downloadedDir = "./downloaded";

// 导入依赖
const fs = require("fs");
const shell = require("shelljs");
const {
  extractPackageNamesDeep,
  formatPackageTgzName,
} = require("./util/lockUtil");
const { download } = require("./util/downloadUtil");
const logger = require("./util/logUtil");

// 读取lock文件并反序列化
const packageLockData = fs.readFileSync("./package-lock.json", "utf8");
const packageLock = JSON.parse(packageLockData);

// 过滤依赖列表(由于没有深入了解package-lock机制，因此将所有出现的package都过滤出来，不只是依赖)
const packageList = extractPackageNamesDeep(packageLock);

// 读取downloadedDir已存在文件列表
const skipList = fs
  .readdirSync(downloadedDir)
  .concat(fs.readdirSync(downloadDir));

// 过滤已存在文件
const downloadList = [];
packageList.forEach((packageName) => {
  const tgz = formatPackageTgzName(packageName);
  if (!skipList.includes(tgz)) {
    downloadList.push(packageName);
  }
});

logger.info(
  `总计获取到${packageList.length}个依赖包，其中${
    packageList.length - downloadList.length
  }个已在${downloadedDir}目录下存在`
);
logger.info(`待下载任务：${downloadList.length}`);
logger.info("开始执行：");

shell.cd(downloadDir);
download(downloadList);
