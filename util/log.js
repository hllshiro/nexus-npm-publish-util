const shell = require("shelljs");

const log = {
  info(msg) {
    shell.echo("[info] " + msg);
  },
  warn(msg) {
    shell.echo("[warn] " + msg);
  },
  error(msg) {
    shell.echo("[error] " + msg);
  },
  info(msg) {
    shell.echo("[info] " + msg);
  },
};

module.exports.log = log;
