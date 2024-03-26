const fs = require('fs')
const http = require('http')
const https = require('https')
const crypto = require('crypto')

/**
 * 下载文件
 * @param url
 * @param filePath
 * @returns {Promise<unknown>}
 */
const downloadFile = async function (url, filePath) {
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

const calculateHash = async (filePath, method = 'sha1', result = 'base64') => {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash(method)
		const rs = fs.createReadStream(filePath)
		rs.on('error', reject)
		rs.on('data', (chunk) => hash.update(chunk))
		rs.on('end', () => resolve(hash.digest(result)))
	})
}

module.exports = {
	downloadFile,
	calculateHash
}
