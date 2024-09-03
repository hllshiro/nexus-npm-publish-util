import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const argv = yargs(hideBin(process.argv))
  .option('name', {
    alias: 'n',
    description: '待下载的包名',
    type: 'string'
  })
  // ... (rest of the options remain the same)
  .wrap(104)
  .check((argv) => {
    // ... (checks remain the same)
    return true
  })
  .help().argv

export default argv
