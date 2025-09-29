import http from 'http'
import https from 'https'
import { exec } from 'child_process'
import ProgressBar from 'progress'
import Log from './log.js'
import * as Task from './task.js'

/**
 * 递归请求
 * @param {string} publishURL 发布地址
 * @param {string} continuationToken 续传token
 * @param {Array} list 列表
 * @returns {Promise} 列表
 */
const recursiveReq = async (publishURL, continuationToken, list = []) => {
  const token = continuationToken ? '&continuationToken=' + continuationToken : ''
  const request = publishURL.startsWith('https://') ? https : http
  const data = await new Promise(async (resolve, reject) => {
    request
      .get(publishURL + token, (res) => {
        let raw = ''
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () => {
          resolve(raw)
        })
      })
      .on('error', (err) => {
        reject(err)
      })
  })
  const json = JSON.parse(data)
  if (json.items) {
    list.push(
      ...json.items.map((item) => {
        const g = item.group ? item.group + '-' : ''
        const n = item.name + '-'
        const v = item.version + '.tgz'
        return g + n + v
      })
    )
  }
  if (json.continuationToken) {
    await recursiveReq(publishURL, json.continuationToken, list)
  }
  return list
}

/**
 * 从服务获取包列表
 * @param {string} publishURL 发布地址
 * @returns {Promise} 包列表
 */
export const getPkgListFromService = async (publishURL) => {
  const bar = new ProgressBar('[progress] :elapseds', { total: Number.MAX_VALUE })
  const timer = setInterval(() => {
    bar.tick()
  }, 100)
  try {
    return await recursiveReq(publishURL, null)
  } catch (err) {
    throw err
  } finally {
    bar.update(1)
    clearInterval(timer)
  }
}

/**
 * 执行curl命令
 * @param {string} curl curl命令
 * @param {object} options 选项
 * @returns {Promise} 执行结果
 */
const execCurl = async (curl, options) => {
  return new Promise((resolve, reject) => {
    exec(curl, options, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

/**
 * 发布包
 * @param {Array} publishList 发布列表
 * @param {string} cwd 工作目录
 * @param {string} url 发布地址
 * @param {string} auth 认证信息
 * @param {number} limit 并发数
 * @returns {Promise} 发布结果
 */
export const publish = async (publishList, cwd, url, auth, limit) => {
  const bar = new ProgressBar('[progress] [:bar] :percent :pkg', {
    total: publishList.length + 1,
    complete: '=',
    incomplete: ' ',
    width: 40
  })
  const result = {
    success: 0,
    failed: []
  }
  await Task.async(
    publishList,
    async (pkg) => {
      try {
        const curl = `curl -u ${auth} -X POST \"${url}\" -H "Accept: application/json" -H "Content-Type:multipart/form-data" -F "npm.asset=@${pkg};type=application/x-compressed"`
        const err = await execCurl(curl, { cwd: cwd })
        if (err) {
          throw err
        }
        result.success++
      } catch (err) {
        Log.error('\n发布错误', err)
        result.failed.push(pkg)
      } finally {
        bar.tick({ pkg })
      }
    },
    limit
  )
  bar.update(1, { pkg: '' })
  Log.info('全部发布完成')
  return result
}
