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

// 缓存路径
const TMP_DIR = 'tmp'
const _cd = process.cwd()
const _tmp = path.join(_cd, TMP_DIR)

async function main() {
	try {
		// 环境检查
		const version = Common.nodeVersion()
		if (version == null) {
			throw new Error('未找到node命令')
		} else {
			Log.info(`node版本: ${version}`)
		}
		const registry = Common.npmRegistry()
		if (registry == null) {
			throw new Error('未找到npm命令')
		} else {
			Log.info(`npm仓库: ${registry}`)
		}

		// 创建缓存
		Log.info('创建临时缓存')
		if (shell.test('-e', _tmp)) {
			shell.rm('-rf', _tmp)
		}
		shell.mkdir(_tmp)

		// 创建命令
		let command = `npm install`
		if (argv.name) {
			command += ' ' + argv.name
		}
		if (argv.input) {
			command += (' ' + fs.readFileSync(Common.getAbsolutePath(_cd, argv.input))).replaceAll(/[\n|\r]/g, ' ')
		}
		if (argv.package) {
			shell.cp(argv.package, _tmp)
		}
		if (argv.force) {
			command += ' --force'
		}
		if (argv.legacyPeerDeps) {
			command += ' --legacy-peer-deps'
		}
		command += ` --package-lock-only --prefix "${_tmp}"`
		Log.info(`执行命令生成lock文件: ${command}`)

		// 生成lock文件
		const res = String(execSync(command))
		Log.info('执行结果: ' + res.replaceAll(/[\n|\r]/g, ' '))

		// lock解析
		Log.info('解析lock文件')
		const content = fs.readFileSync(path.join(_tmp, 'package-lock.json'), 'utf8')
		const lockfile = new Lockfile(content, registry)

		// 下载包
		Log.info(`共获取到${lockfile.resolvedPackages.size}个依赖`)
		const result = await lockfile.download(Common.getAbsolutePath(_cd, argv.output), argv.threadNumber)
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
	} catch (err) {
		Log.error(err)
	} finally {
		// 清除缓存
		Log.info(`清除临时缓存`)
		shell.rm('-rf', TMP_DIR)
		shell.exit()
	}
}
main()
