import fs from 'fs'
import http from 'http'
import https from 'https'
import crypto from 'crypto'

/**
 * 下载文件
 * @param {string} url 文件地址
 * @param {string} filePath 文件路径
 * @returns {Promise} 下载结果
 */
export const downloadFile = async function (url, filePath) {
  return new Promise((resolve, reject) => {
    try {
      const ws = fs.createWriteStream(filePath)
      const request = url.startsWith('https://') ? https : http
      request
        .get(
          url,
          {
            keepAlive: true,
            maxRetries: 3,
            timeout: 10000
          },
          (res) => {
            res.pipe(ws)
            ws.on('finish', () => {
              ws.close(() => resolve())
            })
          }
        )
        .on('error', (err) => {
          fs.unlink(filePath, () => reject(err))
        })
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * 计算文件的hash值
 * @param {string} filePath 文件路径
 * @param {string} method 哈希方法，默认sha1
 * @param {string} result 哈希结果，默认base64
 * @returns {Promise} 哈希值
 */
export const calculateHash = async (filePath, method = 'sha1', result = 'base64') => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(method)
    const rs = fs.createReadStream(filePath)
    rs.on('error', reject)
    rs.on('data', (chunk) => hash.update(chunk))
    rs.on('end', () => resolve(hash.digest(result)))
  })
}
