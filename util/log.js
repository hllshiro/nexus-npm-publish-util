import log4js from 'log4js'

log4js.configure({
  appenders: {
    console: { type: 'console' },
    file: { type: 'file', filename: 'output.log' }
  },
  categories: {
    default: { appenders: ['console', 'file'], level: 'info' },
    fileonly: { appenders: ['file'], level: 'info' }
  }
})

export const fileLog = log4js.getLogger('fileonly')
export const Log = log4js.getLogger()
