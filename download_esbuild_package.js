const versions = ['0.11.3', '0.14.54', '0.12.29', '0.14.43', '0.14.29']
const packages = [
  'esbuild-windows-arm64',
  'esbuild-windows-32',
  'esbuild-windows-64',
  'esbuild-android-arm64',
  'esbuild-darwin-arm64',
  'esbuild-darwin-64',
  'esbuild-freebsd-arm64',
  'esbuild-freebsd-64',
  'esbuild-openbsd-64',
  'esbuild-linux-arm',
  'esbuild-linux-arm64',
  'esbuild-linux-32',
  'esbuild-linux-mips64le',
  'esbuild-linux-ppc64le',
  'esbuild-linux-64',
  'esbuild-sunos-64'
]
// 每次下载的文件会放在download里，publish到仓库后，可以手动移动到download/downloaded里，方便下次避免重复下载
const downloadDir = './download'
const downloadedDir = './downloaded'

const shell = require('shelljs')
const fs = require('fs')

function download(fileNames = []) {
  shell.cd(downloadDir)
  let count = 0
  fileNames.forEach(fileName => {
    const fileExec = shell.exec(`npm pack ${fileName}`, {
      async: true,
      silent: true
    })
    fileExec.stdout
      .on('data', () => {
        ++count
        console.info(`>>> ${fileName} 下载完成...`)
        if (count === fileNames.length) {
          shell.cd('..')
          shell.exit(0)
        }
      })
      .on('err', () => {
        ++count
        console.error(`>>> ${fileName} 下载失败！！！...`)
        if (count === fileNames.length) {
          shell.cd('..')
          shell.exit(0)
        }
      })
  })
}

function downloadEsBuildPackages() {
  const nMap = new Map()
  const NotMap = new Map()
  const downloadedArr = fs.readdirSync(downloadedDir)

  function getAllList() {
    packages.forEach(package => {
      versions.forEach(version => {
        const depWithVersion = `${package}@${version}`
        const tgzFormat = `${package}-${version}.tgz`
        if (!nMap.has(depWithVersion) && !downloadedArr.includes(tgzFormat)) {
          nMap.set(depWithVersion, true)
        } else if (
          downloadedArr.includes(tgzFormat) &&
          !NotMap.has(tgzFormat)
        ) {
          NotMap.set(tgzFormat, true)
        }
      })
    })
  }

  getAllList()
  console.log(
    `一共${
      Array.from(NotMap.keys()).length
    }个依赖包已在${downloadedDir}目录下存在，不需要重复下载：\n`
  )
  console.log(`一共${Array.from(nMap.keys()).length}个依赖包待下载\n`)
  console.log(
    `>>> 待下载列表： \n - ${Array.from(nMap.keys()).join('\n - ')}...`
  )
  download(Array.from(nMap.keys()))
}

downloadEsBuildPackages()
