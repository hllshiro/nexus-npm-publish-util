/**
 * 解析 `target` 包依赖并下载
 * 受当前目录下package.json文件影响，若只解析package.json文件，请将target值设为空字符串''
 * 请确保路径 ./download 和 ./download/downloaded 存在
 * 若package.json中有冲突，请将force设置为true，追加'--legacy-peer-deps'参数
 */
const target = 'process-nextick-args@~1.0.0';
const force = false;

const { exec } = require("child_process");

let command = `npm i ${target} --package-lock-only`;
if (force) {
  command += " --legacy-peer-deps";
}

exec(command, (error, stdout, stderror) => {
  if (error) {
    console.error("package-lock.json文件生成失败...", error);
    return;
  }
  exec('del package.json')
  exec('node downloadWithLockFile.js')
});