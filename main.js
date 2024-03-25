/**
 * 解析 `target` 包依赖并下载
 * 受当前目录下package.json文件影响，若只解析package.json文件，请将target值设为空字符串''
 * 请确保路径 ./download 和 ./download/downloaded 存在
 * 若package.json中有冲突，请将force设置为true，追加'--legacy-peer-deps'参数
 */
const fs = require('fs')
const path = require('path')
const shell = require('shelljs')
const { execSync } = require('child_process')

const { argv, Common } = require('./util/common')
const { Lockfile } = require('./util/lockfile')
const { Log } = require('./util/Log')
const {getPkgListFromService} = require("./util/publish");

// 缓存路径
const _CD = process.cwd()
const _CACHE = path.join(_CD, '.cache')

/**
 * 环境检查
 */
let npmVer
let npmRegistry
const envCheck = () => {
	npmVer = Common.nodeVersion()
	if (npmVer == null) {
		throw new Error('未找到node命令')
	} else {
		Log.info(`node版本: ${npmVer}`)
	}
	npmRegistry = Common.npmRegistry()
	if (npmRegistry == null) {
		throw new Error('未找到npm命令')
	} else {
		Log.info(`npm仓库: ${npmRegistry}`)
	}
}

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
	createCache()
	// 创建命令
	let command = `npm install`
	if (argv.name) {
		command += ' ' + argv.name
	}
	if (argv.input) {
		command += (' ' + fs.readFileSync(Common.getAbsolutePath(_CD, argv.input))).replaceAll(/[\n|\r]/g, ' ')
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

	// 生成lock文件
	const res = String(execSync(command))
	Log.info('执行结果: ' + res.replaceAll(/[\n|\r]/g, ' '))

	// lock解析
	Log.info('解析lock文件')
	const content = fs.readFileSync(path.join(_CACHE, 'package-lock.json'), 'utf8')
	const lockfile = new Lockfile(content, npmRegistry)

	// 下载包
	Log.info(`共获取到${lockfile.resolvedPackages.size}个依赖`)
	const result = await lockfile.download(Common.getAbsolutePath(_CD, argv.output), argv.threadNumber)
	// 回显结果
	if (result.success > 0) {
		Log.info(`成功(${result.success})`)
	}
	if (result.skipped > 0) {
		Log.info(`跳过(${result.skipped})`)
	}
	if (result.failed.length > 0) {
		Log.info(`失败(${result.failed.length})`)
		Log.info(result.failed.join('\n'))
	}
}

const publishMode = async () => {
	Log.info('发布模式')
	// 获取服务端缓存
	let servicePkgList = []
	if (!argv.forcePublish) {
		Log.info('获取服务端缓存')
		servicePkgList = await getPkgListFromService(argv.publishUrl)
	} else {
		Log.info('跳过服务端缓存')
	}
	console.log()
}

const main = async () => {
	try {
		envCheck()
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
