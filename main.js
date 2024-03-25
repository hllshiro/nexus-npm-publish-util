/**
 * 解析 `target` 包依赖并下载
 * 受当前目录下package.json文件影响，若只解析package.json文件，请将target值设为空字符串''
 * 请确保路径 ./download 和 ./download/downloaded 存在
 * 若package.json中有冲突，请将force设置为true，追加'--legacy-peer-deps'参数
 */
const fs = require("fs");
const path = require("path");
const shell = require("shelljs");
const { execSync } = require("child_process");

const { argv, nodeVersion } = require("./util/common");
const { download } = require("./util/download");
const { extractResolvedUrls } = require("./util/lockfile");
const { log } = require("./util/log");

// 检查node环境
const version = nodeVersion();
if (version == null) {
  log.error("缺少node环境。");
} else {
  log.info(`使用node版本: ${version}`);
}

// 缓存路径
const _cd = process.cwd()
const _tmp = path.join(_cd, "tmp");

// 创建并进入临时目录
log.info("创建临时目录 tmp");
shell.mkdir("tmp");
// process.chdir(_tmp)

let command = `npm install`;
if (argv.name) {
  command += " " + argv.name;
}
if (argv.package) {
  shell.cp(argv.package, tmpPath);
}
if (argv.force) {
  command += " --force";
}
if (argv.legary) {
  command += " --legacy-peer-deps";
}
command += ` --package-lock-only --prefix ${_tmp}`;
log.info(`执行命令: ${command}`);
// 执行命令，生成lock文件
const res = execSync(command, { cwd: _tmp });

// 退出并删除临时目录
log.info(`删除临时目录 tmp`);
// process.chdir(_cd)
shell.rm("-rf", "tmp");
shell.exit();

const downloadDir = "./download";

if (target == null || target.trim() === "") {
  target = "";
} else {
  target += " ";
}

command = `npm install ${target}--package-lock-only`;
if (force) {
  command += " --legacy-peer-deps";
}

console.log(`exec command: "${command}"`);
exec(command, (error, stdout, stderror) => {
  if (error) {
    console.error("package-lock.json文件生成失败...", error);
    return;
  }
  console.info("解析完成");
  // 读取lock文件并反序列化
  const packageLockData = fs.readFileSync("./package-lock.json", "utf8");
  const packageLock = JSON.parse(packageLockData);
  const urls = extractResolvedUrls(packageLock);

  console.info(`总计获取到${urls.size}个依赖包`);
  console.info("开始下载");
  download(urls, downloadDir);
});
