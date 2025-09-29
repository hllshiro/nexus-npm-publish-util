import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const argv = yargs(hideBin(process.argv))
  .option('name', {
    alias: 'n',
    description: 'Package name to download',
    type: 'string'
  })
  .option('input', {
    alias: 'i',
    description: 'File with package names',
    type: 'string'
  })
  .option('package', {
    description: 'Path to package.json',
    type: 'string'
  })
  .option('lock', {
    description: 'Parse package-lock.json (highest priority)',
    type: 'string'
  })
  .option('registry', {
    description: 'Override registry URL',
    type: 'string'
  })
  .option('force', {
    description: 'Add --force to npm install',
    type: 'boolean',
    default: false
  })
  .option('legacy-peer-deps', {
    description: 'Add --legacy-peer-deps to npm install',
    type: 'boolean',
    default: false
  })
  .option('output', {
    alias: 'o',
    description: 'Download save path',
    type: 'string',
    default: 'download'
  })
  .option('publish', {
    alias: 'p',
    description: 'Enable publish mode (highest priority)',
    type: 'boolean',
    default: false
  })
  .option('publish-dir', {
    description: 'Directory with packages to publish',
    type: 'string',
    default: 'download'
  })
  .option('publish-url', {
    description: 'Repository publish URL',
    type: 'string'
  })
  .option('publish-auth', {
    description: 'Repository auth (username:password)',
    type: 'string'
  })
  .option('force-publish', {
    description: 'Force publish all packages',
    type: 'boolean',
    default: false
  })
  .option('thread-number', {
    description: 'Concurrent threads for download/publish',
    type: 'number',
    default: 1
  })
  .wrap(100) // 为了输出美观，需要调整行宽为适当的值
  .check((argv) => {
    if (argv.name && argv.input) {
      throw new Error('[error] Cannot use --name and --input parameters simultaneously')
    }
    if (argv.force && argv.legacy) {
      throw new Error('[error] Cannot use --force and --legacy-peer-deps parameters simultaneously')
    }
    if (argv.publish && (!argv.publishUrl || !argv.publishAuth)) {
      throw new Error('[error] Must specify --publish-url and --publish-auth parameters in publish mode')
    }
    return true
  })
  .help().argv

export default argv
