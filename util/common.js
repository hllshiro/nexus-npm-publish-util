import { execSync } from 'child_process'
import ProgressBar from 'progress'

export const nodeVersion = () => {
  try {
    const stdout = execSync('node -v', { silent: true, encoding: 'utf8' })
    return stdout.trim()
  } catch (error) {
    return null
  }
}

export const npmRegistry = () => {
  try {
    let stdout = execSync('npm config get registry', { silent: true, encoding: 'utf8' })
    let url = stdout.trim()
    if (!url.endsWith('/')) {
      url += '/'
    }
    return url
  } catch (error) {
    return null
  }
}

export const execSyncWithProgress = (command) => {
  const bar = new ProgressBar('[progress] :elapseds', { total: Number.MAX_VALUE })
  const timer = setInterval(() => {
    bar.tick()
  }, 100)

  try {
    const stdout = execSync(command, { silent: true, encoding: 'utf8' })
    return stdout
  } catch (err) {
    throw err
  } finally {
    clearInterval(timer)
    bar.update(1)
  }
}
