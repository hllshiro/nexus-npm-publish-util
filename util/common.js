const shell = require('shelljs')

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
	}
}

module.exports = Common
