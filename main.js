/**
 * 解析 `target` 包依赖并下载
 * 受当前目录下package.json文件影响，若只解析package.json文件，请将target值设为空字符串''
 * 请确保路径 ./download 和 ./download/downloaded 存在
 * 若package.json中有冲突，请将force设置为true，追加'--legacy-peer-deps'参数
 */
const fs = require('fs')
const path = require('path')
const shell = require('shelljs')

const argv = require('./util/argv')
const Common = require('./util/common')
const Lockfile = require('./util/lockfile')
const Log = require('./util/log')
const { getPkgListFromService, publish } = require('./util/publish')

// 缓存路径
const _CD = process.cwd()
const _CACHE = path.join(_CD, '.cache')

/**
 * 创建缓存
 */
const createCache = () => {
	Log.info('创建临时缓存')
	if (shell.test('-e', _CACHE)) {
		shell.rm('-rf', _CACHE)
	}
	shell.mkdir(_CACHE)
}

/**
 * 清除缓存
 */
const clearCache = () => {
	if (shell.test('-e', _CACHE)) {
		Log.info(`清除临时缓存`)
		shell.rm('-rf', _CACHE)
		shell.exit()
	}
}

const downloadMode = async () => {
	Log.info('下载模式')
	// 环境检查
	const nodeVer = Common.nodeVersion()
	if (nodeVer == null) {
		throw new Error('未找到node命令')
	} else {
		Log.info(`node版本: ${nodeVer}`)
	}
	const npmRegistry = argv.registry ? argv.registry : Common.npmRegistry()
	if (npmRegistry == null) {
		throw new Error('未找到npm命令')
	} else {
		Log.info(`npm仓库: ${npmRegistry}`)
	}
	createCache()
	if (argv.lock) {
		// lock模式
		shell.cp(argv.lock, _CACHE)
	} else {
		// 生成lock
		let command = `npm install`
		if (argv.name) {
			command += ' ' + argv.name
		}
		if (argv.input) {
			command += (' ' + fs.readFileSync(argv.input)).replaceAll(/[\n|\r]/g, '')
		}
		if (argv.package) {
			shell.cp(argv.package, _CACHE)
		}
		if (argv.force) {
			command += ' --force'
		}
		if (argv.legacyPeerDeps) {
			command += ' --legacy-peer-deps'
		}
		command += ` --package-lock-only --prefix "${_CACHE}"`
		Log.info(`执行命令生成lock文件: ${command}`)
		Log.info('执行结果：' + (await Common.exec(command)))
	}

	// lock解析
	Log.info('解析lock文件')
	const content = fs.readFileSync(path.join(_CACHE, 'package-lock.json'), 'utf8')
	const lockfile = new Lockfile(content, npmRegistry)

	// 下载包
	Log.info(`共获取到${lockfile.resolvedPackages.size}个依赖`)
	const res = await lockfile.download(argv.output, argv.threadNumber)
	// 回显结果
	if (res.success > 0) {
		Log.info(`成功(${res.success})`)
	}
	if (res.failed.length > 0) {
		Log.error(
			`失败(${res.failed.length})`,
			res.failed.map((pkg) => `${pkg.name}@${pkg.version}: ${pkg.resolved}`).join('\n')
		)
	}
}

const publishMode = async () => {
	Log.info('发布模式')
	// 获取服务端缓存
	let servicePkgList = []
	if (argv.forcePublish) {
		Log.info('跳过远程仓库扫描')
	} else {
		Log.info('扫描远程仓库(nexus仓库为单线程模型，获取时间与仓库大小有关)')
		servicePkgList = await getPkgListFromService(argv.publishUrl)
		Log.info(`扫描结束，共获取到${servicePkgList.length}个包`)
	}
	Log.info('扫描待发布目录')
	const list = fs.readdirSync(argv.publishDir).filter((item) => servicePkgList.indexOf(item) === -1)
	if (list.length > 0) {
		Log.info(`找到${list.length}个待上传的包`)
		Log.info('开始发布')
		const res = await publish(list, argv.publishDir, argv.publishUrl, argv.publishAuth, argv.threadNumber)
		// 回显结果
		if (res.success > 0) {
			Log.info(`成功(${res.success})`)
		}
		if (res.failed.length > 0) {
			Log.error(`失败(${res.failed.length})`, res.failed.join('\n'))
		}
	} else {
		Log.error('未找到待发布的包或全部存在于远端仓库')
	}
}

const main = async () => {
	try {
		if (argv.publish) {
			await publishMode()
		} else {
			await downloadMode()
		}
	} catch (err) {
		Log.error('执行失败', err)
	} finally {
		clearCache()
	}
}
main().then(() => {
	Log.info('执行结束')
})
