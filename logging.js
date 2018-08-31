/**
 * Logging management
 * @module logging
 */

const winston = require('winston');
const fs = require('fs-extra');

/**
 * @function errorLog winston logger for errors
 */
let errorLog;

/**
 * @function accessLog winston logger for access requests
 */
let accessLog;

/**
 * Setup logging, including capturing exit precursor events to flush logs
 * @param {string} logFilesPath File system path to the directory to contain the logs
 * @returns {{errorLog, accessLog}} Object {errorLog, accessLog} with winston module loggers
 */
function setupLogging(logFilesPath) {
  const { createLogger, format, transports } = winston;
  const { combine, timestamp, printf } = format;
  const fileFormat = printf(info => {
    return `${info.timestamp} ${info.level}: ${info.message}`;
  });
  const consoleFormat = printf(info => {
    return `${info.level}: ${info.message}`;
  });

  if (!fs.existsSync(logFilesPath)) {
    fs.ensureDirSync(logFilesPath, {mode: 0o777});
  }

  const errorFileTransport = new transports.File(
    {
      filename: logFilesPath + '/error.log',
      maxsize: 1000000,
      maxFiles: 3
    }
  );
  errorLog = createLogger({
    level: 'verbose',
    transports: [
      new transports.Console(
        {
          level: 'info',
          format: combine(
            winston.format.colorize(),
            consoleFormat)
        }),
      errorFileTransport
    ],
    format: combine(timestamp(), fileFormat)
  });

  const accessFileTransport = new transports.File(
    {
      filename: logFilesPath + '/access.log',
      maxsize: 1000000,
      maxFiles: 3
    }
  );
  accessLog = createLogger({
    level: 'info',
    transports: [
      accessFileTransport
    ],
    format: combine(timestamp(), fileFormat)
  });

  function closeMe() {
    Promise.all([
      new Promise(resolve => {
        accessFileTransport.close(() => resolve());
      }),
      new Promise(resolve => {
        errorFileTransport.close(() => resolve());
      })
    ])
      .then(process.exit());
  }

  process.on('SIGINT', function() {
    closeMe();
  });

  process.on('SIGTERM', function() {
    closeMe();
  });
  module.exports.errorLog = errorLog;
  module.exports.accessLog = accessLog;
  return {errorLog, accessLog};
}

module.exports = {
  errorLog,
  accessLog,
  setupLogging
}