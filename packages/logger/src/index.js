// packages/logger/src/index.js

function getTimestamp() {
  return new Date().toISOString();
}

function log(level, message, ...args) {
  const timestamp = getTimestamp();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
}

function info(message, ...args) {
  log('info', message, ...args);
}

function error(message, ...args) {
  log('error', message, ...args);
}

function warn(message, ...args) {
  log('warn', message, ...args);
}

function debug(message, ...args) {
  log('debug', message, ...args);
}

module.exports = {
  info,
  error,
  warn,
  debug,
};