/**
 * 将路径 needToUploadFilesDir 下的包发布到私服
 *
 * 上传tgz的目录 needToUploadFilesDir
 * 私服地址 publishRestful
 * 私服用户 nexusUser
 */
const http = require('http')
const https = require('https')
const { exec } = require('child_process')
const ProgressBar = require('progress')
const Log = require('./log')
const Task = require('./task')

/**
 * 递归扫描远程仓库
 * @param publishURL
 * @param continuationToken
 * @param list
 * @return {Promise<*[]>}
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
 * 扫描远程仓库
 * 针对nexus有效，其他未测试
 * @param publishURL
 * @return {Promise<*[]>}
 */
const getPkgListFromService = async (publishURL) => {
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
 * 异步发布
 * @param curl
 * @param options
 * @return {Promise<unknown>}
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
 * 发布
 * @param publishList 发布列表
 * @param auth 认证
 * @param url 地址
 * @param cwd 包地址
 * @param limit 并发数
 * @return {Promise<{success: number, failed: *[]}>}
 */
const publish = async (publishList, cwd, url, auth, limit) => {
	const bar = new ProgressBar('[progress] [:bar] :percent :pkg', {
		total: publishList.length + 1,
		complete: '=',
		incomplete: ' ',
		width: 100
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

module.exports = {
	getPkgListFromService,
	publish
}
