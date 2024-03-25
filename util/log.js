const Log = {
	info(msg) {
		console.info('[info] ' + msg)
	},
	warn(msg) {
		console.warn('[warn] ' + msg)
	},
	error(msg) {
		console.error('[error] ' + msg)
	}
}

module.exports.Log = Log
