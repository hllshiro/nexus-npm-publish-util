const Log = {
	info(msg) {
		console.info('[info] ' + msg)
	},
	warn(msg) {
		console.warn('[warn] ' + msg)
	},
	error(msg, ...o) {
		console.error('[error] ' + msg, o)
	}
}

module.exports.Log = Log
