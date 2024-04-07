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
}

const ALARM_TIME= 11;
const RANGE_IN_TIME = 10;
const RANGE_OUT_TIME = 30;
const PERMISSION_NUM_ADMIN = 0;
const DEFAULT_VACANCES_COUNT = 3;
const ONE_DAY_MILLISECONDS = 51464318;
const SUNDAY = 0;
const SATURDAY = 6;

module.exports = {
  getYearMonthDate,
  getFileName,

  RANGE_IN_TIME,
  RANGE_OUT_TIME,
  PERMISSION_NUM_ADMIN,
  DEFAULT_VACANCES_COUNT,
  ONE_DAY_MILLISECONDS,
  SUNDAY,
  SATURDAY,
  ALARM_TIME
};
