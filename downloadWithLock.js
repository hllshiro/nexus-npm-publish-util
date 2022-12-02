/**
 * 解析当前文件夹下package-lock.json文件的依赖，将dependencies和packages中涉及到的依赖全部下载
 * 请确保路径 ./download 和 ./download/downloaded 存在
 */
const shell = require('shelljs')
const JSON5 = require('json5')
const { exec } = require('child_process')
const fs = require('fs')

function download(fileNames = []) {
  shell.cd('download')
  let count = 0
  fileNames.forEach(fileName => {
    // shell.echo(`>>> 正在下载 ${fileName}...`);
    const fileExec = shell.exec(`npm pack ${fileName}`, {
      async: true,
      silent: true
    })
    fileExec.stdout
      .on('data', () => {
        ++count
        shell.echo(`>>> ${fileName} 下载完成...`)
        if (count === fileNames.length) {
          shell.cd('..')
          shell.exit(0)
        }
      })
      .on('err', () => {
        ++count
        shell.echo(`>>> ${fileName} 下载失败！！！...`)
        if (count === fileNames.length) {
          shell.cd('..')
          shell.exit(0)
        }
      })
  })
}

function downloadByPackageJsonLockFile(depLockJsonFile = {}) {
  const nMap = new Map()
  const NotMap = new Map()
  const downloadedDir = './download/downloaded' // 每次下载的文件会放在download里，publish到仓库后，可以手动移动到download/downloaded里，方便下次避免重复下载
  const downloadedArr = fs.readdirSync(downloadedDir)

  /**
   * 获取dependencies
   * @param {*} depJson
   */
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

  /**
   * 获取devDependencies
   * @param {*} depJson
   */
  function getDevList(depJson) {
    if (depJson) {
      Object.keys(depJson).forEach(dep => {
        if (dep === '') {
          return
        }
        const packageName = dep.replace('node_modules/', '')
        const depWithVersion = `${packageName}@${depJson[dep].version}`
        let tgzFormat = `${packageName}-${depJson[dep].version}.tgz`
        // eg: @babel/code-frame-7.14.5.tgz -> babel-code-frame-7.14.5.tgz
        tgzFormat = packageName.startsWith('@')
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
  getDevList(depLockJsonFile.packages)
  shell.echo(
    `一共${
      Array.from(NotMap.keys()).length
    }个依赖包已在${downloadedDir}目录下存在，不需要重复下载：\n`
  )
  shell.echo(
    `>>> 无需下载列表： \n - ${Array.from(NotMap.keys()).join('\n - ')}...\n`
  )
  shell.echo(`一共${Array.from(nMap.keys()).length}个依赖包待下载\n`)
  shell.echo(
    `>>> 待下载列表： \n - ${Array.from(nMap.keys()).join('\n - ')}...`
  )
  download(Array.from(nMap.keys()))
}

const pkgLock = require('./package-lock')
downloadByPackageJsonLockFile(pkgLock)
