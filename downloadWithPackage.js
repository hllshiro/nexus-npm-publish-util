/**
 * 解析 `target` 包依赖并下载
 * 受当前目录下package.json文件影响，若只解析package.json文件，请将target值设为空字符串''
 * 请确保路径 ./download 和 ./download/downloaded 存在
 * 若package.json中有冲突，请将force设置为true，追加'--legacy-peer-deps'参数
 */
const target = ''
const force = true

// 每次下载的文件会放在download里，publish到仓库后，可以手动移动到download/downloaded里，方便下次避免重复下载
const downloadDir = './download'
const downloadedDir = './downloaded'

const shell = require('shelljs')
const { exec } = require('child_process')
const fs = require('fs')


const { promisify } = require('util');
const sleep = promisify(setTimeout);

let worker = 0;
let count = 0;
let total = 0;

function getWorker() {
  if (worker < 20) {
    worker++;
    return true;
  } else {
    return false
  }
}

function putWorker() {
  worker--;
}

function runExec(fileName) {
  const fileExec = shell.exec(`npm pack ${fileName}`, {
    async: true,
    silent: true
  })
  fileExec.stdout
    .on('data', () => {
      ++count
      putWorker()
      console.info(`>>> ${fileName} 下载完成...`)
      if (count === total) {
        shell.cd('..')
        shell.exit(0)
      }
    })
    .on('err', () => {
      ++count
      putWorker()
      console.error(`>>> ${fileName} 下载失败！！！...`)
      if (count === total) {
        shell.cd('..')
        shell.exit(0)
      }
    })
}

async function download(fileNames = []) {
  total = fileNames.length;
  try {
    while (fileNames.length !== 0) {
      if (getWorker()) {
        runExec(fileNames.shift());
      } else {
        await sleep(1000)
      }
    }
  } catch (e) {
    console.error(e)
  }

}

function downloadByPackageJsonLockFile(depLockJsonFile = {}) {
  const nMap = new Map()
  const NotMap = new Map()
  const downloadedArr = fs.readdirSync(downloadedDir)

  function getAllList(depJson) {
    if (depJson) {
      Object.keys(depJson).forEach(dep => {
        const depWithVersion = `${dep}@${depJson[dep].version}`
        let tgzFormat = `${dep}-${depJson[dep].version}.tgz`
        // eg: @babel/code-frame-7.14.5.tgz -> babel-code-frame-7.14.5.tgz
        tgzFormat = dep.startsWith('@')
          ? tgzFormat
            .split('/')
            .join('-')
            .slice(1)
          : tgzFormat
        if (!nMap.has(depWithVersion) && !downloadedArr.includes(tgzFormat)) {
          nMap.set(depWithVersion, true)
          getAllList(depJson[dep].dependencies)
        } else if (
          downloadedArr.includes(tgzFormat) &&
          !NotMap.has(tgzFormat)
        ) {
          NotMap.set(tgzFormat, true)
        }
      })
    }
  }

  getAllList(depLockJsonFile.dependencies)
  console.log(
    `一共${Array.from(NotMap.keys()).length
    }个依赖包已在${downloadedDir}目录下存在，不需要重复下载：\n`
  )
  console.log(`一共${Array.from(nMap.keys()).length}个依赖包待下载\n`)
  console.log(
    `>>> 待下载列表： \n - ${Array.from(nMap.keys()).join('\n - ')}...`
  )
  shell.cd(downloadDir)
  download(Array.from(nMap.keys()))
}
let command = `npm i ${target} --package-lock-only`
if (force) {
  command += ' --legacy-peer-deps'
}

exec(command, (error, stdout, stderror) => {
  if (error) {
    console.error('package-lock.json文件生成失败...', error)
    return
  }
  const pkgLock = require('./package-lock')
  downloadByPackageJsonLockFile(pkgLock)
})
