const config = require('./config');

// Simple console logger
// In a real application, you might use a more robust library like Winston or Pino

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = levels[config.logLevel.toLowerCase()] ?? levels.info;

const log = (level, ...args) => {
  if (levels[level] <= currentLevel) {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [${level.toUpperCase()}]`, ...args);
  }
};

const logger = {
  error: (...args) => log('error', ...args),
  warn: (...args) => log('warn', ...args),
  info: (...args) => log('info', ...args),
  debug: (...args) => log('debug', ...args), // Added debug level
};

module.exports = logger;
