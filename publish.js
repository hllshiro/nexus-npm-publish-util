/**
 * 将路径 needToUploadFilesDir 下的包发布到私服
 *
 * 上传tgz的目录 needToUploadFilesDir
 * 私服地址 publishRestful
 * 私服用户 nexusUser
 */
let fs = require('fs')
let path = require('path')
const { exec } = require('child_process')
const axios = require('axios')

const needToUploadFilesDir = './download' // 自定义，待上传tgz文件所在目录s
const publishRestful =
  'http://nexus.senjone.com/service/rest/v1/components?repository=npm-hosted'
const nexusUser = 'admin:nexus'

// 保存nexus仓库已有依赖
const publishInfo = {
  error: [],
  new: [],
  exist: []
}

const excludeExistedFiles = () => {
  fs.readdir(needToUploadFilesDir, (err, files) => {
    console.log('》》》2.上传tgz《《《')
    files
      .filter(f => !publishInfo.exist.includes(f))
      .forEach(f => {
        const file = f // path.resolve(needToUploadFilesDir, f);
        const curlCmd = `curl -u ${nexusUser} -X POST \"${publishRestful}\" -H "Accept: application/json" -H "Content-Type:multipart/form-data" -F "npm.asset=@${file};type=application/x-compressed"`

        exec(curlCmd, { cwd: needToUploadFilesDir }, function(
          error,
          stdout,
          stderr
        ) {
          if (error) {
            publishInfo.error.push(file)
            console.error(file + ' publish 失败')
            console.log(error)
          } else {
            publishInfo.new.push(file)
            console.log(file + ' publish 成功', stdout)
          }
        })
      })
  })
}

const getReq = async continuationToken => {
  const contiToken = continuationToken
    ? '&continuationToken=' + continuationToken
    : ''
  const result = await axios.get(publishRestful + contiToken)
  if (result.status === 200 && result.data && result.data.items) {
    publishInfo.exist.push(
      ...result.data.items.map(item => {
        const g = item.group ? item.group + '-' : ''
        const n = item.name + '-'
        const v = item.version + '.tgz'
        return g + n + v
      })
    )

    if (result.data.continuationToken) {
      await getReq(result.data.continuationToken)
    } else {
      console.log('请求结束时间戳: ', new Date().valueOf())
      console.log('请求完毕，结果写入文件中(备用，可忽略) ')
      fs.writeFile(
        new Date().valueOf() + '.log',
        JSON.stringify(publishInfo, null, 2),
        err => {
          console.log('结果写入文件完毕! ! !')
          //借助nexus rest API上传文件
          excludeExistedFiles()
        }
      )
    }
  } else {
    console.log('》》》》请求出现异常《《《')
  }
}

console.log('》》》1.获取仓库中已有依赖，大概需要2~3分钟，请耐心等候..《《《')
console.log('开始请求时间戳: ', new Date().valueOf())
console.log('请求中......')

getReq()
