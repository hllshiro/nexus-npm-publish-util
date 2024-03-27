/**
 * 异步任务
 */
const Task = {
	/**
	 * 异步并发控制队列
	 * @param arr 参数队列
	 * @param fn 异步执行器，执行fn(i)，i是arr中的元素
	 * @param limit 线程数，默认为1
	 * @return {Promise<Awaited<unknown>[]>}
	 */
	async: async (arr, fn, limit = 1) => {
		const ret = []
		const executing = []
		for (const i of arr) {
			const promise = Promise.resolve().then(() => fn(i))
			ret.push(promise)
			if (limit <= arr.length) {
				const e = promise.then(() => executing.split(executing.indexOf(e), 1))
				executing.push(e)
				if (executing.length >= limit) {
					await Promise.race(executing)
				}
			}
		}
		return Promise.all(ret)
	},
	/**
	 *
	 * @param arr 参数队列
	 * @param fn 异步执行器，执行fn(i)，i是arr中的元素
	 * @param limit 线程数，默认为1
	 * @return {Promise<unknown>}
	 */
	asyncResult: (arr, fn, limit = 1) => {
		const args = [...arr] // 拷贝参数，不改变传入数组
		const results = [] // 最终结果
		let runningCount = 0 // 正在运行的数量
		let resultIndex = 0 // 结果的下标，用于控制结果的顺序
		let resultCount = 0 // 结果的数量

		return new Promise((resolve) => {
			function run() {
				while (runningCount < limit && args.length > 0) {
					runningCount++
					// 闭包用于保存结果下表，便于在resolve时把结果放到合适的位置
					;((i) => {
						const v = args.shift()
						fn(v)
							.then(
								(val) => {
									results[i] = val
								},
								() => {
									throw new Error(`An error occurred: ${v}`)
								}
							)
							.finally(() => {
								runningCount--
								resultCount++
								if (resultCount === arr.length) {
									resolve(results)
								} else {
									run()
								}
							})
					})(resultIndex++)
				}
			}
			run()
		})
	}
}

module.exports = Task
