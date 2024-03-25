const yargs = require('yargs')
const shell = require('shelljs')
const path = require('path')
/**
 * 启动参数、帮助
 */
const argv = yargs
	.option('name', {
		alias: 'n',
		description: '待下载的包名',
		type: 'string'
	})
	.option('input', {
		alias: 'i',
		description: '包含包名的文件路径',
		type: 'string'
	})
	.option('package', {
		description: '待解析的package.json文件路径',
		type: 'string'
	})
	.option('force', {
		description: '调用"npm install"时追加--force参数',
		type: 'boolean',
		default: false
	})
	.option('legacy-peer-deps', {
		description: '调用"npm install"时追加--legacy-peer-deps参数',
		type: 'boolean',
		default: false
	})
	.option('output', {
		alias: 'o',
		description: '下载文件保存路径',
		type: 'string',
		default: 'download'
	})
	.option('thread-number', {
		description: '并发下载线程数',
		type: 'number',
		default: 10
	})
	.option('publish', {
		alias: 'p',
		description: '发布模式',
		type: 'boolean',
		default: false
	})
	.option('publish-dir', {
		description: '包含待发布包的目录路径',
		type: 'string',
		default: 'download'
	})
	.check((argv) => {
		if (!argv.name && !argv.input && !argv.package && !argv.publish) {
			throw new Error('[error] 至少指定--name/--input/--package/--publish中的一个')
		}
		if (argv.name && argv.input) {
			throw new Error('[error] 不能同时使用--name和--input参数')
		}
		if (argv.force && argv.legacy) {
			throw new Error('[error] 不能同时使用--force和--legacy-peer-deps参数')
		}
		return true
	})
	.help().argv

const Common = {
	/**
	 * 获取当前系统node版本
	 * @returns string|null
	 */
	nodeVersion: () => {
		if (!shell.which('node')) {
			return null
		} else {
			return shell.exec('node -v', { silent: true }).replaceAll('\n', '')
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
			let url = shell.exec('npm config get registry', { silent: true }).replaceAll('\n', '')
			if (!url.endsWith('/')) {
				url += '/'
			}
			return url
		}
	},
	/**
	 * 获取绝对路径
	 * @param _cd 当前路径
	 * @param path 待转换路径
	 * @return string
	 */
	getAbsolutePath: (_cd, p) => {
		if (path.isAbsolute(p)) {
			return p
		}
		return path.join(_cd, p)
	}
}

module.exports = {
	argv,
	Common
}
