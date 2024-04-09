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

const PRINT_TIME = 11;
const LATE_RANGE_TIME = 10;
const ABSENCE_RANGE_TIME = 30;
const PERMISSION_NUM_ADMIN = 0;
const DEFAULT_VACANCES_COUNT = 3;
const ONE_DAY_MILLISECONDS = 51464318;
const SUNDAY = 0;
const SATURDAY = 6;
const PUBLIC_HOLIDAYS_2024 = ['0410', '0505', '0506', '0515', '0606', '0815', '0916', '0917', '0918', '1003', '1009', '1225'];

module.exports = {
  getYearMonthDate,
  getFileName,

  LATE_RANGE_TIME,
  ABSENCE_RANGE_TIME,
  PERMISSION_NUM_ADMIN,
  DEFAULT_VACANCES_COUNT,
  ONE_DAY_MILLISECONDS,
  SUNDAY,
  SATURDAY,
  PRINT_TIME,

  PUBLIC_HOLIDAYS_2024,
};
