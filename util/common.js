const shell = require('shelljs')
const { exec } = require('child_process')
const ProgressBar = require('progress')
const Log = require("./log");

const Common = {
	/**
	 * 获取当前系统node版本
	 * @returns string|null
	 */
	nodeVersion: () => {
		if (!shell.which('node')) {
			return null
		} else {
			return shell.exec('node -v', { silent: true }).replaceAll(/[\n|\r]/g, '')
		}
	},
	/**
	 * 获取当前仓库路径
	 * @returns string|null
	 */
	npmRegistry: () => {
		if (!shell.which('npm')) {
			return null
		} else {
			let url = shell.exec('npm config get registry', { silent: true }).replaceAll(/[\n|\r]/g, '')
			if (!url.endsWith('/')) {
				url += '/'
			}
			return url
		}
	},
	exec: async (command) => {
		const bar = new ProgressBar('[progress] :elapseds', { total: Number.MAX_VALUE })
		const timer = setInterval(() => {
			bar.tick()
		}, 100)
		try {
			return await new Promise((resolve, reject) => {
				exec(command, (error, stdout, stderr) => {
					if (error) {
						reject(error)
					} else {
						resolve(stdout)
					}
				})
			})
		} catch (err) {
			throw err
		} finally {
			clearInterval(timer)
			bar.update(1)
		}
	}
}

module.exports = Common
