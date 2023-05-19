const log4js = require("log4js");
const cluster = require("cluster");

class LogUtil {
  constructor(logFile) {
    this.logFile = logFile;
    this.logger = null;
    this.start();
  }

  log(level, ...args) {
    console[level](...args);
    /* if (cluster.isMaster) {
      // 主进程直接使用 logger 记录日志
      this.logger[level](args);
    } else {
      // 在工作进程中通过主进程发送消息来记录日志
      process.send({ type: "log", message: { level, args } });
    } */
  }
  info(...args) {
    this.log("info", args);
  }
  warn(...args) {
    this.warn("info", args);
  }
  error(...args) {
    this.error("info", args);
  }

  initializeLogger() {
    log4js.configure({
      appenders: {
        fileAppender: {
          type: "file",
          filename: this.logFile + ".log",
        },
      },
      categories: {
        default: { appenders: ["fileAppender"], level: "info" },
      },
    });

    this.logger = log4js.getLogger();
  }

  setupMasterProcess() {
    // 监听来自工作进程的消息
    process.on("message", (message) => {
      if (message.type === "log") {
        this.logger[message.level](message.args);
      }
    });
  }

  start() {
    if (cluster.isMaster) {
      this.initializeLogger();
      this.setupMasterProcess();

      // Fork 工作进程
      const numWorkers = require("os").cpus().length;
      for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
      }
    }
  }
}

const logger = {
  info: function (...args) {
    console.info(...args);
  },
  warn: function (...args) {
    console.warn(...args);
  },
  error: function (...args) {
    console.error(...args);
  },
};

module.exports = logger;
