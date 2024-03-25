const yargs = require('yargs')
const shell = require('shelljs')

/**
 * 启动参数、帮助
 */
const argv = yargs
	.option('name', {
		alias: 'n',
		description: '待下载的package包名，格式与"npm install"命令一致',
		type: 'string'
	})
	.option('package', {
		alias: 'p',
		description: '待解析的package.json文件路径',
		type: 'string'
	})
	.option('output', {
		alias: 'o',
		description: '下载文件保存路径，默认为"./download"',
		type: 'string'
	})
	.option('force', {
		alias: 'f',
		description: '调用"npm install"时追加--force参数',
		type: 'boolean'
	})
	.option('legacy', {
		alias: 'l',
		description: '调用"npm install"时追加--legacy-peer-deps参数',
		type: 'boolean'
	})
	.option('log-level', {
		description: '输出日志级别'
	})
	.check((argv) => {
		if (!argv.name && !argv.package) {
			throw new Error('[error] 至少输入一个参数')
		}
		if (argv.force && argv.legacy) {
			throw new Error('[error] 不能同时使用--force和--legacy参数')
		}
		return true
	})
	.help().argv

/**
 * 获取当前系统node版本
 * @returns string|null
 */
const nodeVersion = () => {
	if (!shell.which('node')) {
		return null
	} else {
		return shell.exec('node -v', { silent: true }).replaceAll("\n", "")
	}
}

/**
 * 获取当前仓库路径
 * @returns string|null
 */
const npmRegistry = () => {
	if (!shell.which('npm')) {
		return null
	} else {
		let url = shell.exec('npm config get registry', { silent: true }).replaceAll("\n", "")
		if (!url.endsWith('/')) {
			url += '/'
		}
		return url
	}
}

module.exports = {
	argv,
	nodeVersion,
	npmRegistry
}
