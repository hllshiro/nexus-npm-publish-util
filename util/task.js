export const async = async (arr, fn, limit = 1) => {
  const ret = []
  const executing = []
  for (const i of arr) {
    const promise = Promise.resolve().then(() => fn(i))
    ret.push(promise)
    if (limit <= arr.length) {
      const e = promise.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      if (executing.length >= limit) {
        await Promise.race(executing)
      }
    }
  }
  return Promise.all(ret)
}

export const asyncResult = (arr, fn, limit = 1) => {
  const args = [...arr]
  const results = []
  let runningCount = 0
  let resultIndex = 0
  let resultCount = 0

  return new Promise((resolve) => {
    function run() {
      while (runningCount < limit && args.length > 0) {
        runningCount++
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
