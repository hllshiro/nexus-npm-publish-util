import fs from 'fs'
import fetch from 'node-fetch'
import crypto from 'crypto'

/**
 * 下载文件（推荐方式）
 * @param {string} url 文件地址
 * @param {string} filePath 文件路径
 * @returns {Promise<void>}
 */
export const downloadFile = async function (url, filePath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载失败: ${res.statusText}`)
  const fileStream = fs.createWriteStream(filePath)
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream)
    res.body.on('error', reject)
    fileStream.on('finish', () => {
      fileStream.on('close', resolve)
      fileStream.close()
    })
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
