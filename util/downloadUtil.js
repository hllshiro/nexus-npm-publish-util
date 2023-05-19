const shell = require("shelljs");
const logger = require("./logUtil");

let worker = 0;
function getWorker() {
  if (worker < 10) {
    worker++;
    return true;
  } else {
    return false;
  }
}

function putWorker() {
  worker--;
}

function runExec(fileName) {
  return new Promise((resolve, reject) => {
    shell.exec(
      `npm pack ${fileName}`,
      { async: true, silent: true },
      (code, stdout, stderr) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(stderr);
        }
      }
    );
  });
}

async function download(fileNames = [], total = fileNames.length, count = 0) {
  const tasks = [];
  while (fileNames.length !== 0 && getWorker()) {
    const fileName = fileNames.shift();
    if (fileName.indexOf("undefined") > -1) {
      logger.warn(`(${++count}/${total}) ${fileName} 包不合法`);
      putWorker();
    } else {
      tasks.push(
        runExec(fileName)
          .then(() => {
            logger.info(`(${++count}/${total}) ${fileName} 下载完成`);
          })
          .catch((err) => {
            logger.error(`(${++count}/${total}) ${fileName} 下载失败`, err);
          })
          .finally(() => {
            putWorker();
          })
      );
    }
  }

  await Promise.all(tasks);

  if (fileNames.length !== 0) {
    await download(fileNames, total, count); // 递归调用下载剩余的文件
  }
}

module.exports = {
  download,
};
