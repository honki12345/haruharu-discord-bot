import { logger } from './logger.js';

const getYearMonthDate = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: ('0' + (now.getMonth() + 1)).slice(-2),
    date: ('0' + now.getDate()).slice(-2),
    day: now.getDay(),
    hours: ('0' + now.getHours()).slice(-2),
    minutes: ('0' + now.getMinutes()).slice(-2),
  };
};

const isLastDayOfMonth = (year: number, month: number, date: number): boolean => {
  // new Date(year, month, 0)는 주어진 달(다음 달의 0번째 날짜)의 마지막 날짜를 반환
  const lastDateOfMonth = new Date(year, Number(month), 0).getDate();

  // 주어진 날짜(date)가 그 달의 마지막 날짜와 같은지 확인
  return date === lastDateOfMonth;
};

const getFormattedYesterday = () => {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = ('0' + (now.getMonth() + 1)).slice(-2);
  const date = ('0' + now.getDate()).slice(-2);
  return year + month + date;
};

const getFileName = (filename: string) => {
  return filename.substring(filename.lastIndexOf('/'));
};

const getTimeDiffFromNowInMinutes = (timestamp: number) => {
  const now = Date.now();
  const timeDiff = now - timestamp;
  return Math.floor(timeDiff / 1000 / 60);
};

const calculateWeekTimes = () => {
  const { year, month, date } = getYearMonthDate();
  const now = new Date(year + '-' + month + '-' + date);
  return Math.floor((now.getTime() - HARUHARU_TIMES.getTime()) / 1000 / 60 / 60 / 24 / 7);
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
  logger.info(`remaining challenge print time: target - now: ${target.getTime() - now.getTime()}`);

  return target.getTime() - now.getTime();
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
  logger.info(`remaining cam study print time: target - now: ${target.getTime() - now.getTime()}`);

  return target.getTime() - now.getTime();
};

const formatFromMinutesToHours = (minutes: number) => {
  const dividedByHour = Math.floor(minutes / 60);
  const remainderByHour = minutes % 60;
  if (dividedByHour) {
    return `${dividedByHour}시간 ${remainderByHour}분`;
  }

  return `${remainderByHour}분`;
};

// cam study 관련 상수들
const LEAST_TIME_LIMIT = 5;
const PRINT_HOURS_CAM_STUDY = 23;
const PRINT_MINUTES_CAM_STUDY = 59;
const HARUHARU_TIMES = new Date('2024-04-06'); // 토요일

// challenge 관련 상수들
const PRINT_HOURS_CHALLENGE = 13;
const LATE_RANGE_TIME = 10;
const ABSENCE_RANGE_TIME = 30;
const DEFAULT_VACANCES_COUNT = 5;

const PERMISSION_NUM_ADMIN = 0;
const ONE_DAY_MILLISECONDS = 86400000;
const SUNDAY = 0;
const FRIDAY = 5; // TODO FRIDAY = 5 이지만 테스트를 위해 목요일 4 로 수정해놓는다
const SATURDAY = 6;
// const PUBLIC_HOLIDAYS_2024 = ['0410', '0505', '0506', '0515', '0606', '0815', '0916', '0917', '0918', '1001', '1003', '1009', '1225'];
const PUBLIC_HOLIDAYS_2025 = [
  '0101',
  '0127',
  '0128',
  '0129',
  '0130',
  '0301',
  '0303',
  '0505',
  '0506',
  '0606',
  '0815',
  '1003',
  '1005',
  '1006',
  '1007',
  '1008',
  '1009',
  '1225',
];

export {
  getYearMonthDate,
  getFileName,
  calculateRemainingTimeChallenge,
  calculateRemainingTimeCamStudy,
  calculateWeekTimes,
  formatFromMinutesToHours,
  getFormattedYesterday,
  getTimeDiffFromNowInMinutes,
  isLastDayOfMonth,
  LEAST_TIME_LIMIT,
  LATE_RANGE_TIME,
  ABSENCE_RANGE_TIME,
  PERMISSION_NUM_ADMIN,
  DEFAULT_VACANCES_COUNT,
  ONE_DAY_MILLISECONDS,
  SUNDAY,
  FRIDAY,
  SATURDAY,
  PUBLIC_HOLIDAYS_2025,
};
