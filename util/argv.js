const yargs = require('yargs')

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
	.option('lock', {
		description: '直接解析package-lock.json文件，优先级最高',
		type: 'string'
	})
	.option('registry', {
		description: '覆盖默认registry配置，用于包解析',
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
	.option('publish', {
		alias: 'p',
		description: '发布模式，优先级高于下载参数',
		type: 'boolean',
		default: false
	})
	.option('publish-dir', {
		description: '包含待发布包的目录路径',
		type: 'string',
		default: 'download'
	})
	.option('publish-url', {
		description: '远程仓库发布地址',
		type: 'string'
	})
	.option('publish-auth', {
		description: '远程仓库认证信息，例如[用户名:密码]',
		type: 'string'
	})
	.option('force-publish', {
		description: '强制发布所有的包，默认跳过远程仓库已存在的包',
		type: 'boolean',
		default: false
	})
	.wrap(104) // 为了输出美观，需要调整行宽为适当的值
	.check((argv) => {
		if (!argv.name && !argv.input && !argv.package && !argv.lock && !argv.publish) {
			throw new Error('[error] 至少指定--name/--input/--package/--lock/--publish中的一个')
		}
		if (argv.name && argv.input) {
			throw new Error('[error] 不能同时使用--name和--input参数')
		}
		if (argv.force && argv.legacy) {
			throw new Error('[error] 不能同时使用--force和--legacy-peer-deps参数')
		}
		if (argv.publish && (!argv.publishUrl || !argv.publishAuth)) {
			throw new Error('[error] 发布模式下必须指定--publish-url和--publish-auth参数')
		}
		return true
	})
	.help().argv

module.exports = argv
