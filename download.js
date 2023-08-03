/**
 * 解析当前文件夹下package-lock.json文件的依赖，将dependencies和packages中涉及到的依赖全部下载
 * 请确保路径 ./download 和 ./download/downloaded 存在
 */

// 每次下载的文件会放在download里，publish到仓库后，可以手动移动到download/downloaded里，方便下次避免重复下载
const downloadDir = "./download";

// 导入依赖
const fs = require("fs");
const {
  extractResolvedUrls
} = require("./util/lockUtil");
const { downloadUrls } = require("./util/downloadUtil");
const logger = require("./util/logUtil");

// 读取lock文件并反序列化
const packageLockData = fs.readFileSync("./package-lock.json", "utf8");
const packageLock = JSON.parse(packageLockData);
const urls = extractResolvedUrls(packageLock);

logger.info(`总计获取到${urls.length}个依赖包`);
logger.info("开始下载");
downloadUrls(urls, downloadDir);
