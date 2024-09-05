import { spawn, execSync } from 'child_process'

/**
 * 获取node版本
 * @returns {string} node版本
 */
export const nodeVersion = () => {
  try {
    const stdout = execSync('node -v', { silent: true, encoding: 'utf8' })
    return stdout.trim()
  } catch (error) {
    return null
  }
}

/**
 * 获取npm registry
 * @returns {string} registry
 */
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

/**
 * 执行命令并实时显示输出
 * @param {string} cmd 命令
 * @param {string[]} args 命令参数
 * @returns {Promise<string>} 命令输出
 */
export const execInherit = (cmd, args) => {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })
  })
}
