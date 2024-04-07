const winston = require('winston');
const winstonDaily = require('winston-daily-rotate-file');
const appRoot = require('app-root-path');
const process = require('node:process');

const logDir = `${appRoot}/logs`;

// 어떤 로그를 로그 파일에 기록할 때 어떤 형식으로 기록할지
const {
  combine,
  timestamp,
  label,
  prettyPrint,
} = winston.format;

// log level
// error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5
const logger = winston.createLogger({
  format: combine(
    label({
      label: 'haruharu',
    }),
    timestamp({
      foramt: 'YYYY-MM-DD HH:mm:ss',
    }),
    prettyPrint(),
  ),
  transports: [
    // info 레벨 로그를 저장할 파일 설정
    new winstonDaily({
      level: 'info',
      datePattern: 'YYYY-MM-DD',
      dirname: logDir,
      filename: `%DATE%.log`,
      maxFiles: 30, // 30일치
      zippedArchive: true,
    }),
    // error level
    new winstonDaily({
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      dirname: logDir,
      filename: `%DATE%.error.log`,
      maxFiles: 30, // 30일치
      zippedArchive: true,
    }),
  ],
  exceptionHandlers: [  // uncaughtException 발생시
    new winstonDaily({
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      dirname: logDir,
      filename: `%DATE%.exception.log`,
      maxFiles: 30, // 30일치
      zippedArchive: true,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.prettyPrint(),
    ),
  }))
  ;
}

module.exports = logger;