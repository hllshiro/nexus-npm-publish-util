/**
 * 解析 `target` 包依赖并下载
 * 受当前目录下package.json文件影响，若只解析package.json文件，请将target值设为空字符串''
 * 请确保路径 ./download 和 ./download/downloaded 存在
 * 若package.json中有冲突，请将force设置为true，追加'--legacy-peer-deps'参数
 */
const target = 'node-nightly@^1.7.3'
const force = false

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

/*
 * param packageNameOrWidthVersion，形如react、react@^16.13.0都可以，遵守npm规范即可
 * */
function downloadNpm(packageNameOrWidthVersion) {
  const nMap = new Map()

  function getAllList(pkg) {
    if (nMap.has(pkg) || !pkg) {
      return
    }
    nMap.set(pkg, true)

    // 寻找依赖
    const execLine = `npm view ${pkg} dependencies --json`
    const execResult = shell.exec(execLine, { async: false, silent: true })

    let deps
    try {
      if (execResult.stdout) {
        deps = JSON5.parse(execResult.stdout)
        /*
         * {"loose-envify": "^1.1.0", "object-assign": "^4.1.1", "prop-types": "^15.6.2"} 转换成
         * ["loose-envify^1.1.0", "object-assign^4.1.1", "prop-types^15.6.2"]
         */
        let depPackages = []
        if (Array.isArray(deps)) {
          deps.forEach(dep => {
            if (Object.prototype.toString.apply(dep) === '[object Object]') {
              depPackages.push(
                ...Object.keys(dep).map(d =>
                  dep[d].includes(' ') ? `${d}@'${dep[d]}'` : `${d}@${dep[d]}`
                )
              )
            }
          })
        } else if (
          Object.prototype.toString.apply(deps) === '[object Object]'
        ) {
          depPackages = Object.keys(deps).map(dep =>
            deps[dep].includes(' ')
              ? `${dep}@'${deps[dep]}'`
              : `${dep}@${deps[dep]}`
          )
        }

        depPackages.forEach(dep => {
          getAllList(dep)
        })
      }
    } catch (e) {
      console.debug('getAllList ', pkg, '的dependencies下载报错：', e)
    }
  }

  getAllList(packageNameOrWidthVersion)
  shell.echo(`一共${Array.from(nMap.keys()).length}个依赖包待下载\n`)
  shell.echo(
    `>>> 待下载列表： \n - ${Array.from(nMap.keys()).join('\n - ')}...`
  )
  download(Array.from(nMap.keys()))
}

function downloadByPackageJsonLockFile(depLockJsonFile = {}) {
  const nMap = new Map()
  const NotMap = new Map()
  const downloadedDir = './download/downloaded' // 每次下载的文件会放在download里，publish到仓库后，可以手动移动到download/downloaded里，方便下次避免重复下载
  const downloadedArr = fs.readdirSync(downloadedDir)

  function getAllList(depJson) {
    shell.echo(depJson)
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

  shell.echo(depLockJsonFile.dependencies)
  getAllList(depLockJsonFile.dependencies)
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

/*
 * 方式一：通过具体npm包下载相关依赖
 */
// downloadNpm('node-nightly@^1.7.3');

/*
 * 建议用这种方式，简单、快捷、错误少（将node-nightly@^1.7.3替换成需要的依赖和版本号即可）
 * 方式二：通过生成package-lock.json下载所有依赖--package-lock-only
 * 忽略冲突--legacy-peer-deps
 */

const command = `npm i ${target} --package-lock-only`
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
