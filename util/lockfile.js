/**
 * lockfile解析类
 */
const Log = require('./log')
const shell = require('shelljs')
const fs = require('fs')
const { downloadFile, calculateHash } = require('./download')
const path = require('path')
const ProgressBar = require('progress')

class Lockfile {
	/**
	 * 解析缓存
	 */
	resolvedPackages

	/**
	 * 构造函数
	 * @param content lock文件内容
	 * @param baseURL 仓库地址
	 */
	constructor(content, baseURL) {
		this.resolvedPackages = resolveLockfile(JSON.parse(content), baseURL)
	}

	/**
	 * 下载依赖包
	 * @param output 保存路径
	 * @param threads 下载线程数
	 */
	async download(output, threads) {
		const result = {
			success: 0,
			failed: []
		}
		if (!shell.test('-e', output)) {
			shell.mkdir(output)
		}
		const bar = new ProgressBar('[progress] [:bar] :percent :pkg', {
			total: this.resolvedPackages.size + 1,
			complete: '=',
			incomplete: ' ',
			width: 100
		})
		const promises = Array.from(this.resolvedPackages).map(async (pkg) => {
			try {
				bar.tick({ pkg: pkg.file })
				const savePath = path.join(output, pkg.file)
				if (!fs.existsSync(savePath)) {
					// 已存在跳过下载
					const err = await downloadFile(pkg.resolved, savePath)
					if (err) {
						result.failed.push(pkg)
						return
					}
				}
				const verify = pkg.integrity.split('-')
				const fileHash = await calculateHash(savePath, verify[0], 'base64')
				if (fileHash === verify[1]) {
					result.success++
				} else {
					result.failed.push(pkg)
				}
			} catch (err) {
				result.failed.push(pkg)
			}
		})

		try {
			for (let i = 0; i < promises.length; i += threads) {
				const task = promises.slice(i, i + threads)
				await Promise.all(task)
			}
			bar.update(1, { pkg: '' })
			Log.info('全部下载完成')
		} catch (err) {
			bar.interrupt('下载意外终止')
			Log.error('下载失败', err)
		} finally {
			// 移除错误的包
			result.failed.forEach((pkg) => {
				fs.rmSync(path.join(output, pkg.file))
			})
		}
		return result
	}
}

/**
 * 解析lockfile
 * @param lockfileObj
 * @param baseURL
 * @returns {Set<any>}
 */
const resolveLockfile = (lockfileObj, baseURL) => {
	switch (lockfileObj.lockfileVersion) {
		case 2:
			return resolveV3(Object.assign(lockfileObj.packages, lockfileObj.dependencies), baseURL)
		case 3:
			return resolveV3(lockfileObj.packages, baseURL)
		default:
			throw new Error(`unsupported lockfile version: ${this.lockfileObj.lockfileVersion}`)
	}
}

/**
 * v3版本解析
 * @param packages
 * @param baseURL
 * @returns {Set<any>}
 */
const resolveV3 = (packages, baseURL) => {
	const res = new Set()
	for (const pkg in packages) {
		if (packages.hasOwnProperty(pkg) && pkg !== '') {
			// 依赖包
			const properties = packages[pkg]
			const resolved = resolveURL(properties.resolved, baseURL)
			if (resolved.length !== 3) {
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
	const reg = new RegExp(`${baseURL}(.+)\/-\/(.+\.tgz)`)
	return url.match(reg)
}

module.exports = Lockfile
