const logger = require('./logger');
const getYearMonthDate = () => {
  const now = new Date();
  return ({
    year: now.getFullYear(),
    month: ('0' + (1 + now.getMonth())).slice(-2),
    date: ('0' + now.getDate()).slice(-2),
    day: now.getDay(),
    hours: ('0' + now.getHours()).slice(-2),
    minutes: ('0' + now.getMinutes()).slice(-2),
  });
};

const getFileName = (filename) => {
  return filename.substring(filename.lastIndexOf('/'));
};

const calculateRemainingTimeChallenge = () => {
  const now = new Date();
  const target = new Date();
  target.setHours(PRINT_HOURS_CHALLENGE);
  target.setMinutes(0);
  target.setSeconds(0);
  target.setMilliseconds(0);

  if (now > target) {
    target.setDate(now.getDate() + 1);
  }
  logger.info(`remaining challenge print time: target - now: ${target - now}`);

  return target - now;
};

const calculateRemainingTimeCamStudy = () => {
  const now = new Date();
  const target = new Date();
  target.setHours(PRINT_HOURS_CAM_STUDY);
  target.setMinutes(PRINT_MINUTES_CAM_STUDY);
  target.setSeconds(0);
  target.setMilliseconds(0);

  if (now > target) {
    target.setDate(now.getDate() + 1);
  }
  logger.info(`remaining cam study print time: target - now: ${target - now}`);

  return target - now;
};


// cam study 관련 상수들
const LEAST_TIME_LIMIT = 1;
const PRINT_HOURS_CAM_STUDY = 23;
const PRINT_MINUTES_CAM_STUDY = 59;

// challenge 관련 상수들
const PRINT_HOURS_CHALLENGE = 11;
const LATE_RANGE_TIME = 10;
const ABSENCE_RANGE_TIME = 30;
const DEFAULT_VACANCES_COUNT = 3;

const PERMISSION_NUM_ADMIN = 0;
const ONE_DAY_MILLISECONDS = 51464318;
const SUNDAY = 0;
const SATURDAY = 6;
const PUBLIC_HOLIDAYS_2024 = ['0410', '0505', '0506', '0515', '0606', '0815', '0916', '0917', '0918', '1003', '1009', '1225'];

module.exports = {
  getYearMonthDate,
  getFileName,
  calculateRemainingTimeChallenge,
  calculateRemainingTimeCamStudy,

  LEAST_TIME_LIMIT,
  LATE_RANGE_TIME,
  ABSENCE_RANGE_TIME,
  PERMISSION_NUM_ADMIN,
  DEFAULT_VACANCES_COUNT,
  ONE_DAY_MILLISECONDS,
  SUNDAY,
  SATURDAY,
  PRINT_TIME: PRINT_HOURS_CAM_STUDY,

  PUBLIC_HOLIDAYS_2024,
};
