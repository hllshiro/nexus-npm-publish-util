import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import ProgressBar from 'progress'

const exec = promisify(execCallback)

export const nodeVersion = async () => {
  try {
    const { stdout } = await exec('node -v', { silent: true })
    return stdout.trim()
  } catch (error) {
    return null
  }
}

export const npmRegistry = async () => {
  try {
    let { stdout } = await exec('npm config get registry', { silent: true })
    let url = stdout.trim()
    if (!url.endsWith('/')) {
      url += '/'
    }
    return url
  } catch (error) {
    return null
  }
}

export const execWithProgress = async (command) => {
  const bar = new ProgressBar('[progress] :elapseds', { total: Number.MAX_VALUE })
  const timer = setInterval(() => {
    bar.tick()
  }, 100)

  try {
    const { stdout } = await exec(command)
    return stdout
  } catch (err) {
    throw err
  } finally {
    clearInterval(timer)
    bar.update(1)
  }
}
