import Log from './log.js'
import fs from 'fs'
import path from 'path'
import ProgressBar from 'progress'
import { downloadFile, calculateHash } from './download.js'
import * as Task from './task.js'

const blackList = ['', , '.', '..']

export default class Lockfile {
  resolvedPackages

  constructor(content, baseURL) {
    this.resolvedPackages = resolveLockfile(JSON.parse(content), baseURL)
  }

  async download(output, limit) {
    if (!fs.existsSync(output)) {
      fs.mkdirSync(output, { recursive: true })
    }
    const result = {
      success: 0,
      failed: []
    }
    const bar = new ProgressBar('[progress] [:bar] :percent :pkg', {
      total: this.resolvedPackages.size + 1,
      complete: '=',
      incomplete: ' ',
      width: 40
    })
    await Task.async(
      this.resolvedPackages,
      async (pkg) => {
        try {
          const savePath = path.join(output, pkg.file)
          const verify = pkg.integrity.split('-')
          let need = true
          if (fs.existsSync(savePath)) {
            const fileHash = await calculateHash(savePath, verify[0], 'base64')
            if (fileHash === verify[1]) {
              result.success++
              need = false
            }
          }
          if (need) {
            const err = await downloadFile(pkg.resolved, savePath)
            if (err) {
              throw new Error(err)
            }
            const fileHash = await calculateHash(savePath, verify[0], 'base64')
            if (fileHash !== verify[1]) {
              throw new Error(`${pkg.name} 校验不匹配`)
            }
            result.success++
          }
        } catch (err) {
          Log.error('\n下载错误', err)
          result.failed.push(pkg)
        } finally {
          bar.tick({ pkg: pkg.file })
        }
      },
      limit
    )
    bar.update(1, { pkg: '' })
    Log.info('全部下载完成')
    return result
  }
}

const resolveLockfile = (lockfileObj, baseURL) => {
  switch (lockfileObj.lockfileVersion) {
    case 2:
      return resolveV3(Object.assign(lockfileObj.packages, lockfileObj.dependencies), baseURL)
    case 3:
      return resolveV3(lockfileObj.packages, baseURL)
    default:
      throw new Error(`unsupported lockfile version: ${lockfileObj.lockfileVersion}`)
  }
}

const resolveV3 = (packages, baseURL) => {
  const res = new Set()
  for (const [pkg, properties] of Object.entries(packages)) {
    if (!blackList.includes(pkg)) {
      const resolved = resolveURL(properties.resolved, baseURL)
      if (!resolved || resolved.length !== 3) {
        Log.warn(`包解析错误: ${pkg} ${properties.resolved}`)
        continue
      }
      res.add({
        name: resolved[1],
        file: resolved[2],
        version: properties.version,
        resolved: properties.resolved,
        integrity: properties.integrity
      })
    }
  }
  return res
}

const resolveURL = (url, baseURL) => {
  if (url == null) return null
  const reg = new RegExp(`${baseURL}(.+)\/-\/(.+\.tgz)`)
  return url.match(reg)
}
