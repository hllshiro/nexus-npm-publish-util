/**
 * 将路径 needToUploadFilesDir 下的包发布到私服
 *
 * 上传tgz的目录 needToUploadFilesDir
 * 私服地址 publishRestful
 * 私服用户 nexusUser
 */
let fs = require('fs')
const { exec } = require('child_process')
const http = require('http')
const ProgressBar = require('progress')

const needToUploadFilesDir = './download' // 自定义，待上传tgz文件所在目录
const publishRestful = 'http://nexus.senjone.com/service/rest/v1/components?repository=npm-hosted'
const nexusUser = 'xqkj:xqkj'

// 保存nexus仓库已有依赖
const publishLog = {
	exist: 0,
	new: 0,
	success: 0,
	error: 0,
	errorLog: []
}
const publishPackages = () => {
	fs.readdir(needToUploadFilesDir, (err, files) => {
		console.log('》》》2.上传tgz《《《')
		// 过滤待上传的包
		const waitForUpload = files.filter((f) => !existedPackages.includes(f))
		let count = 0
		publishLog.new = waitForUpload.length

		waitForUpload.forEach((f) => {
			const file = f // path.resolve(needToUploadFilesDir, f);
			const curlCmd = `curl -u ${nexusUser} -X POST \"${publishRestful}\" -H "Accept: application/json" -H "Content-Type:multipart/form-data" -F "npm.asset=@${file};type=application/x-compressed"`
			console.log(file)

			exec(curlCmd, { cwd: needToUploadFilesDir }, (error, stdout, stderr) => {
				if (error) {
					publishLog.error++
					publishLog.errorLog.push(`[ERROR] publish error: ${file}, reason` + error)
					console.error(file + ' publish failed', error)
				} else {
					publishLog.success++
				}
				if (++count === publishLog.new) {
					fs.writeFile(new Date().valueOf() + '.log', JSON.stringify(publishLog, null, 2), (err) => {
						console.log('publish finished !')
						exec('move /y download*.tgz downloaded')
					})
				}
			})
		})
	})
}

const recursiveReq = async (publishURL, continuationToken, list = []) => {
	const token = continuationToken ? '&continuationToken=' + continuationToken : ''
	const data = await new Promise(async (resolve, reject) => {
		http
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

const getPkgListFromService = async (publishURL) => {
	const bar = new ProgressBar('获取中: :elapseds', { total: Number.MAX_VALUE })
	const timer = setInterval(() => {
		bar.tick()
	}, 100)
	try {
		return await recursiveReq(publishURL, null)
	} catch (err) {
		throw err
	} finally {
		clearInterval(timer)
	}
}

module.exports = {
	getPkgListFromService
}
