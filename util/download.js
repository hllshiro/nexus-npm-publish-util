import fs from 'fs'
import http from 'http'
import https from 'https'
import crypto from 'crypto'

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

export const calculateHash = async (filePath, method = 'sha1', result = 'base64') => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(method)
    const rs = fs.createReadStream(filePath)
    rs.on('error', reject)
    rs.on('data', (chunk) => hash.update(chunk))
    rs.on('end', () => resolve(hash.digest(result)))
  })
}
